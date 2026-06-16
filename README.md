# stellar-swap

Outil de **recommandation de route** pour swapper le token **BLND** vers **USDC** ou **EURC** sur Stellar. Il méta-agrège plusieurs sources de cotation indépendantes et classe les routes par **meilleur retour net** (frais d'agrégateur + frais de pool + gas + impact de prix).

**v1 : CLI en lecture seule** — il *recommande* la meilleure route ; il ne signe ni ne soumet aucune transaction. L'exécution se fait dans votre propre wallet.

## Prérequis
- Node 24+ — la CLI de cotation tourne dès Node 20, mais le **collecteur Phase 2** requiert Node ≥ 24 (`node:sqlite` intégré). Développé et testé sous Node 26.

## Installation
```bash
cp .env.example .env      # tout est optionnel (voir Config)
npm install
```

## Usage
```bash
npm run quote -- 1000 USDC              # meilleure route BLND -> USDC pour 1000 BLND
npm run quote -- 1000 EURC              # vers EURC : direct vs via-USDC, le meilleur net est retenu
npm run quote -- 1000 USDC --split      # ajoute l'analyse de fractionnement (25/50/100 %)
npm run quote -- 500 USDC --slippage 30 # tolérance 0,3 % (30 bps)
npm run quote -- 1000 USDC --json       # sortie JSON brute (pour scripts / future app)
```
Options : `--from <ASSET>` (défaut BLND), `--slippage <bps>` (défaut 50), `--split`, `--json`, `--balance` (cote la balance BLND **live** du wallet au lieu d'un montant), `--help`.

Sortie : tableau classé par **net reçu** (frais d'agrégateur + frais de pool + gas + impact de prix),
ligne de recommandation, plancher Horizon (valeur ajoutée des agrégateurs), et pour EURC le duel
direct / via-USDC. **Rien n'est signé ni soumis** — l'exécution se fait dans votre wallet.

## Config (`.env`, tout optionnel)
- `SOROSWAP_API_KEY` — non requis (Soroswap tourne en keyless via `soroswap-router-sdk` local).
- `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` — surchargent les endpoints publics par défaut.
- `WALLET_ADDRESS` — adresse **publique** (jamais de clé privée). Non requise pour les cotations ;
  réservée à l'affichage de la position Blend (ultérieur). La sonde Comet n'en dépend pas.

## Limites connues (v1)
- **Slippage par leg (EURC via-USDC)** : la tolérance `--slippage` n'est pas répartie entre les 2 legs.
  Sans effet en v1 (seul StellarBroker consomme ce paramètre, les autres sources l'ignorent) ; à
  implémenter quand l'exécution multi-leg arrivera.
- **Soroswap keyless** : route sur la **paire directe** uniquement (réserves lues en live). Le multi-hop
  Soroswap complet nécessiterait la clé API ou l'alimentation de plus de paires — la méta-agrégation des
  autres sources compense.
- **Prix spot** : récupérés via DefiLlama (impact de prix indicatif) ; si indisponible, la colonne Δspot
  s'efface — le classement par net reste valable.
- **EURC direct ≈ via-USDC** : quand la même source gagne les deux, les nets sont identiques — il n'existe
  pas de marché BLND/EURC indépendant, tout passe par USDC. Le via-USDC ne gagne que si des sources
  **différentes** sont meilleures sur chaque leg. L'outil signale ce cas explicitement.
- **Comet** : sonde de prix du pool backstop (BLND↔USDC), via une simulation read-only avec un compte
  témoin détenant du BLND ; peut se retirer pour de très gros montants (solde du témoin).

## Collecteur (Phase 2)

Daemon de logging des quotes : cote périodiquement BLND→USDC/EURC (sondes **250/750 BLND**) et persiste chaque mesure dans SQLite (`node:sqlite`), avec **rétention à paliers** (raw 90 j → structuré 1 an → rollup horaire). Base de la future UI de stats « meilleurs créneaux ».

```bash
npm run collector                 # daemon (scheduler interne, cadence .env, défaut 15 min)
npm run tick:once                 # un tick réel → DB + résumé console
npm run history                   # journal des derniers ticks (gagnant par sonde)
npm run export -- csv             # export CSV (ou: npm run export -- json)
npm run quote -- --balance USDC   # cote la balance BLND live (nécessite WALLET_ADDRESS)
```

Config `.env` : `COLLECTOR_CADENCE_SEC`, `COLLECTOR_SIZES_BLND`, `COLLECTOR_PAIRS`, `COLLECTOR_DB_PATH`, `RAW_RETENTION_DAYS`, `ROLLUP_AFTER_DAYS` (voir `.env.example`).

**Déploiement (NUC, Docker)** : `sudo mkdir -p /docker/stellarswap-collector/data` puis `sudo docker compose up -d`. Service durci (root:root + `cap_drop`/`read_only`/`no-new-privileges`/limites, sans port exposé). En prod, épingler `IMAGE_TAG` dans `.env` (jamais `:latest`) ; image publiée sur ghcr.io via CI sur tag `v*`. `trivy image` avant prod.

## Tests
```bash
npm test         # tests unitaires (adapters figés sur fixtures réelles, normalisation, classement, collecteur, DB…)
npm run typecheck
```

## Structure
- `core/` — moteur pur réutilisable : adapters de sources, normalisation en net réel, classement, analyse de fractionnement, logique EURC (direct vs via-USDC), gas, prix, lecture de balance.
- `cli/` — interface ligne de commande (cotation + journal).
- `collector/` + `db/` — daemon de logging des quotes + base SQLite (Phase 2 : historique, rétention).
- *(ultérieur)* `web/` — UI self-hosted de stats « meilleurs créneaux » + alertes.

## Sources de cotation
xBull, Aquarius, Soroswap, StellarBroker, Ultra Stellar (StellarTerm), Horizon, et une sonde directe du pool Comet (BLND/USDC) — interrogées **en parallèle** et **tolérantes aux pannes** (une source indisponible ne bloque pas le classement).
