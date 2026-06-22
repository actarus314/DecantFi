**English** · [Français](README.fr.md)

# decant.fi — stellar-swap

**Route recommender** for swapping **BLND → USDC or EURC** on Stellar. It meta-aggregates several independent quoting sources and ranks routes by **best net return** (aggregator fees + pool fees + price impact).

**Read-only** — it *recommends* the best route; it never signs or submits any transaction. Execution happens in your own wallet. **Private keys are never requested or handled.**

## Prerequisites

- **Docker** — for self-hosted deployment (collector + web dashboard)
- **Node ≥ 24** — for local development (the collector uses `node:sqlite`; developed and tested on Node 26)

## Quickstart — self-host with Docker

```bash
cp .env.example .env        # adjust if needed (optional Soroswap key, data path, etc.)
docker compose build
docker compose up -d
# Web UI: http://localhost:8080
```

Two services start:
- **collector** — periodically quotes BLND→USDC/EURC and persists results to SQLite (historical data, retention tiers)
- **web** — live simulator + dashboard served at port 8080

### Configurable data path

Set `STELLARSWAP_DATA` in your `.env` to control where the database is stored on the host:

```bash
STELLARSWAP_DATA=./data                          # default (relative to the repo)
STELLARSWAP_DATA=/docker/stellarswap/backend/data  # example: NUC / server path
```

## CLI (development / scripting)

```bash
npm install
npm run quote -- 1000 USDC              # best route BLND -> USDC for 1000 BLND
npm run quote -- 1000 EURC              # to EURC: direct vs via-USDC, best net kept
npm run quote -- 1000 USDC --split      # split analysis (25 / 50 / 100 %)
npm run quote -- 500 USDC --slippage 30 # 0.3 % tolerance (30 bps)
npm run quote -- 1000 USDC --json       # raw JSON output (for scripts)
```

Options: `--from <ASSET>` (default BLND), `--slippage <bps>` (default 50), `--split`, `--json`, `--balance` (quotes the live BLND wallet balance instead of a fixed amount), `--help`.

Output: table ranked by **net received** (aggregator fees + pool fees + price impact), recommendation line, Horizon floor (value added by aggregators), and for EURC the direct vs via-USDC duel. **Nothing is signed or submitted** — execution is in your wallet.

## Config (`.env`, all optional)

- `SOROSWAP_API_KEY` — not required (Soroswap runs keyless via local `soroswap-router-sdk`).
- `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` — override the default public endpoints.
- `WALLET_ADDRESS` — **public** address only (never a private key). Not required for quoting; reserved for future Blend position display.
- `STELLARSWAP_DATA` — host data directory (default `./data`; e.g. `/docker/stellarswap/backend/data` on a NUC).
- `IMAGE_OWNER` — GHCR image owner (default `actarus314`; set to your account if you fork).

## Quoting sources

xBull, Aquarius, Soroswap, StellarBroker, Ultra Stellar (StellarTerm), Horizon, and a direct Comet pool probe (BLND/USDC) — queried **in parallel** and **fault-tolerant** (one unavailable source does not block ranking).

## Collector (Phase 2)

Logging daemon: quotes BLND→USDC/EURC periodically (**250/750 BLND** probes) and persists each measurement to SQLite with **tiered retention** (raw 90 d → structured 1 yr → hourly rollup).

```bash
npm run collector          # daemon (internal scheduler, cadence from .env, default 15 min)
npm run tick:once          # one real tick → DB + console summary
npm run history            # log of last ticks (winner per probe)
npm run export -- csv      # CSV export (or: npm run export -- json)
```

Collector `.env` keys: `COLLECTOR_CADENCE_SEC`, `COLLECTOR_SIZES_BLND`, `COLLECTOR_PAIRS`, `COLLECTOR_DB_PATH`, `RAW_RETENTION_DAYS`, `ROLLUP_AFTER_DAYS`.

**Production (Docker):** pin `IMAGE_TAG` in `.env` (never `:latest`); image published to ghcr.io on tag `v*` via CI. Run `trivy image` before production.

## Known limits (v1)

- **Per-leg slippage (EURC via-USDC)**: `--slippage` is not split across the 2 legs. No effect in v1 (only StellarBroker uses this parameter); to be implemented when multi-leg execution arrives.
- **Soroswap keyless**: routes on the **direct pair** only. The full multi-hop Soroswap would need the API key or more pair feeds — meta-aggregation from other sources compensates.
- **Spot price**: retrieved via DefiLlama (indicative price impact); if unavailable, the Δspot column hides — net ranking remains valid.
- **EURC direct ≈ via-USDC**: when the same source wins both, nets are identical — there is no independent BLND/EURC market. The tool signals this case explicitly.
- **Comet**: read-only pool price probe (BLND↔USDC) via a witness account; may retract for very large amounts (witness balance).

## Development

```bash
npm test           # unit tests (adapters frozen on real fixtures, normalisation, ranking, collector, DB…)
npm run typecheck
```

## Project structure

- `core/` — pure reusable engine: source adapters, net normalisation, ranking, split analysis, EURC logic, gas, prices, balance reading.
- `cli/` — command-line interface (quoting + history).
- `collector/` + `db/` — quote-logging daemon + SQLite database (Phase 2: history, retention).
- `web/` — self-hosted stats UI (live simulator + Sankey route graph + historical dashboard).

## License

GPL-3.0-or-later — see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
