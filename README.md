# stellar-swap

Outil de **recommandation de route** pour swapper le token **BLND** vers **USDC** ou **EURC** sur Stellar. Il méta-agrège plusieurs sources de cotation indépendantes et classe les routes par **meilleur retour net** (frais d'agrégateur + frais de pool + gas + impact de prix).

**v1 : CLI en lecture seule** — il *recommande* la meilleure route ; il ne signe ni ne soumet aucune transaction. L'exécution se fait dans votre propre wallet.

## Prérequis
- Node 20+ (développé sous Node 26)

## Installation
```bash
cp .env.example .env      # remplir si besoin (SOROSWAP_API_KEY est optionnel)
npm install
```

## Usage (à venir)
```bash
npm run quote -- 1000 USDC     # meilleure route BLND -> USDC pour 1000 BLND
npm run quote -- 1000 EURC     # idem vers EURC (direct vs via-USDC, le meilleur net est choisi)
```

## Structure
- `core/` — moteur pur réutilisable : adapters de sources, normalisation en net réel, classement, analyse de fractionnement, logique EURC (direct vs via-USDC), gas, prix.
- `cli/` — interface ligne de commande.
- *(ultérieur)* `web/` + `db/` — application self-hosted + historique de swaps et statistiques.

## Sources de cotation
xBull, Aquarius, Soroswap, StellarBroker, Ultra Stellar (StellarTerm), Horizon, et une sonde directe du pool Comet (BLND/USDC) — interrogées **en parallèle** et **tolérantes aux pannes** (une source indisponible ne bloque pas le classement).
