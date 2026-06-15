# stellar-swap

Outil de **recommandation de route** pour swapper le token **BLND** vers **USDC** ou **EURC** sur Stellar. Il méta-agrège plusieurs sources de cotation indépendantes et classe les routes par **meilleur retour net** (frais d'agrégateur + frais de pool + gas + impact de prix).

**v1 : CLI en lecture seule** — il *recommande* la meilleure route ; il ne signe ni ne soumet aucune transaction. L'exécution se fait dans votre propre wallet.

## Prérequis
- Node 20+ (développé et testé sous Node 26)

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
Options : `--from <ASSET>` (défaut BLND), `--slippage <bps>` (défaut 50), `--split`, `--json`, `--help`.

Sortie : tableau classé par **net reçu** (frais d'agrégateur + frais de pool + gas + impact de prix),
ligne de recommandation, plancher Horizon (valeur ajoutée des agrégateurs), et pour EURC le duel
direct / via-USDC. **Rien n'est signé ni soumis** — l'exécution se fait dans votre wallet.

## Config (`.env`, tout optionnel)
- `SOROSWAP_API_KEY` — non requis (Soroswap tourne en keyless via `soroswap-router-sdk` local).
- `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` — surchargent les endpoints publics par défaut.
- `WALLET_ADDRESS` — adresse **publique** ; si fournie, active la sonde directe du pool Comet
  (BLND/USDC) en cross-check (la simulation lit votre solde BLND, lecture seule). Jamais de clé privée.

## Limites connues (v1)
- **Slippage par leg (EURC via-USDC)** : la tolérance `--slippage` n'est pas répartie entre les 2 legs.
  Sans effet en v1 (seul StellarBroker consomme ce paramètre, les autres sources l'ignorent) ; à
  implémenter quand l'exécution multi-leg arrivera.
- **Soroswap keyless** : route sur la **paire directe** uniquement (réserves lues en live). Le multi-hop
  Soroswap complet nécessiterait la clé API ou l'alimentation de plus de paires — la méta-agrégation des
  autres sources compense.
- **Prix spot** : récupérés via DefiLlama (impact de prix indicatif) ; si indisponible, la colonne Δspot
  s'efface — le classement par net reste valable.

## Tests
```bash
npm test         # tests unitaires (adapters figés sur fixtures réelles, normalisation, classement…)
npm run typecheck
```

## Structure
- `core/` — moteur pur réutilisable : adapters de sources, normalisation en net réel, classement, analyse de fractionnement, logique EURC (direct vs via-USDC), gas, prix.
- `cli/` — interface ligne de commande.
- *(ultérieur)* `web/` + `db/` — application self-hosted + historique de swaps et statistiques.

## Sources de cotation
xBull, Aquarius, Soroswap, StellarBroker, Ultra Stellar (StellarTerm), Horizon, et une sonde directe du pool Comet (BLND/USDC) — interrogées **en parallèle** et **tolérantes aux pannes** (une source indisponible ne bloque pas le classement).
