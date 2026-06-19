// Rétention à paliers : purge le raw > rawRetentionDays, agrège en horaire > rollupAfterDays (puis purge
// les lignes par-tick), réclame l'espace. Idempotent (upsert cumulatif sur rollup_hourly).
import type { Db } from '../db/index.js';

export interface MaintenanceConfig { rawRetentionDays: number; rollupAfterDays: number; }

function isoCutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
function hourBucket(iso: string): string {
  return `${iso.slice(0, 13)}:00:00Z`; // "2025-01-01T14:..." -> "2025-01-01T14:00:00Z"
}
function median(sorted: bigint[]): bigint {
  const n = sorted.length;
  if (n === 0) return 0n;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2n;
}

export function runMaintenance(db: Db, cfg: MaintenanceConfig, now: Date): void {
  const raw = db.raw();

  // (1) Purge du raw au-delà de la fenêtre chaude.
  raw.prepare(
    `DELETE FROM quote_raw WHERE quote_id IN (
       SELECT q.id FROM quote q JOIN tick t ON t.id = q.tick_id WHERE t.started_at < ?)`,
  ).run(isoCutoff(now, cfg.rawRetentionDays));

  // (1b) Purge de rpc_call_log au-delà de la même fenêtre de rétention que les ticks.
  // On utilise rollupAfterDays comme seuil de rétention (même logique que la purge des ticks).
  raw.prepare(`DELETE FROM rpc_call_log WHERE at < ?`).run(isoCutoff(now, cfg.rollupAfterDays));

  // (2) Rollup horaire au-delà de la fenêtre tiède, puis suppression des lignes par-tick.
  if (cfg.rollupAfterDays > 0) {
    const cutoff = isoCutoff(now, cfg.rollupAfterDays);
    const sel = raw.prepare(
      `SELECT t.started_at, q.pair, q.amount_in, q.source_id, q.net_out, q.price_impact_pct, t.blnd_usd, t.eurc_stellar_mid
       FROM quote q JOIN tick t ON t.id = q.tick_id
       WHERE q.is_winner = 1 AND q.net_out IS NOT NULL AND t.started_at < ?`,
    );
    sel.setReadBigInts(true);
    const rows = sel.all(cutoff) as Array<Record<string, unknown>>;

    type Acc = { nets: bigint[]; impacts: number[]; impactsLocal: number[]; blnd: number[]; dist: Record<string, number> };
    const groups = new Map<string, { hour: string; pair: string; amount: bigint; acc: Acc }>();
    for (const r of rows) {
      const hour = hourBucket(String(r.started_at));
      const pair = String(r.pair);
      const amount = r.amount_in as bigint;
      const key = `${hour}|${pair}|${amount}`;
      let g = groups.get(key);
      if (!g) { g = { hour, pair, amount, acc: { nets: [], impacts: [], impactsLocal: [], blnd: [], dist: {} } }; groups.set(key, g); }
      g.acc.nets.push(r.net_out as bigint);
      if (r.price_impact_pct !== null) g.acc.impacts.push(Number(r.price_impact_pct));
      if (r.blnd_usd !== null) g.acc.blnd.push(Number(r.blnd_usd));
      const src = String(r.source_id);
      g.acc.dist[src] = (g.acc.dist[src] ?? 0) + 1;
      // Impact local : calculé depuis eurc_stellar_mid pour EURC, ou 1 pour USDC
      const netOut = r.net_out as bigint;
      const amountIn = r.amount_in as bigint;
      const blndUsd = r.blnd_usd != null ? Number(r.blnd_usd) : null;
      const eurcStellarMid = r.eurc_stellar_mid != null ? Number(r.eurc_stellar_mid) : null;
      const isEurc = pair.endsWith('EURC');
      const perUnitLocal = isEurc ? eurcStellarMid : 1;
      if (blndUsd && perUnitLocal && amountIn > 0n) {
        const inUsd = Number(amountIn) * blndUsd;
        const outUsd = Number(netOut) * perUnitLocal;
        if (inUsd > 0) g.acc.impactsLocal.push(((inUsd - outUsd) / inUsd) * 100);
      }
    }

    // NB: en prod un bucket horaire ancien n'est upserté qu'UNE fois (ses ticks sont ensuite supprimés et
    // aucun nouveau tick ne retombe dans une heure passée). La fusion DO UPDATE de net_med est donc une
    // approximation (moyenne pondérée de médianes, tronquée en INTEGER), quasi jamais empruntée — acceptable.
    const upsert = raw.prepare(
      `INSERT INTO rollup_hourly (hour_utc, pair, amount_in, n_ticks, net_min, net_med, net_max, impact_avg, impact_avg_local, winner_dist, blnd_usd_avg)
       VALUES ($hour, $pair, $amount, $n, $min, $med, $max, $impact, $impact_local, $dist, $blnd)
       ON CONFLICT(hour_utc, pair, amount_in) DO UPDATE SET
         net_min = MIN(net_min, excluded.net_min),
         net_max = MAX(net_max, excluded.net_max),
         net_med = (net_med * n_ticks + excluded.net_med * excluded.n_ticks) / (n_ticks + excluded.n_ticks),
         impact_avg = (impact_avg * n_ticks + excluded.impact_avg * excluded.n_ticks) / (n_ticks + excluded.n_ticks),
         impact_avg_local = (COALESCE(impact_avg_local, 0) * n_ticks + COALESCE(excluded.impact_avg_local, 0) * excluded.n_ticks) / (n_ticks + excluded.n_ticks),
         blnd_usd_avg = (blnd_usd_avg * n_ticks + excluded.blnd_usd_avg * excluded.n_ticks) / (n_ticks + excluded.n_ticks),
         winner_dist = $dist_merged,
         n_ticks = n_ticks + excluded.n_ticks`,
    );

    raw.exec('BEGIN');
    try {
      for (const g of groups.values()) {
        const nets = [...g.acc.nets].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const impacts = g.acc.impacts;
        const blnds = g.acc.blnd;
        const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

        // Fusion de winner_dist avec l'existant (pour l'idempotence cumulative).
        const existing = raw.prepare('SELECT winner_dist FROM rollup_hourly WHERE hour_utc=? AND pair=? AND amount_in=?')
          .get(g.hour, g.pair, g.amount) as { winner_dist?: string } | undefined;
        const merged: Record<string, number> = existing?.winner_dist ? JSON.parse(existing.winner_dist) : {};
        for (const [k, v] of Object.entries(g.acc.dist)) merged[k] = (merged[k] ?? 0) + v;

        const impactsLocal = g.acc.impactsLocal;
        upsert.run({
          hour: g.hour, pair: g.pair, amount: g.amount, n: g.acc.nets.length,
          min: nets[0]!, med: median(nets), max: nets[nets.length - 1]!,
          impact: avg(impacts),
          impact_local: impactsLocal.length ? avg(impactsLocal) : null,
          dist: JSON.stringify(g.acc.dist), blnd: avg(blnds),
          dist_merged: JSON.stringify(merged),
        });
      }
      // Supprime les ticks agrégés (CASCADE purge quote + quote_raw).
      raw.prepare('DELETE FROM tick WHERE started_at < ?').run(cutoff);
      raw.exec('COMMIT');
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  }

  // (3) Réclame l'espace libéré.
  raw.exec('PRAGMA incremental_vacuum');
}
