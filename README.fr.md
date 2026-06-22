[English](README.md) · **Français**

# DecantFi

**Recommandeur de route** pour swapper le token **BLND** vers **USDC** ou **EURC** sur Stellar. Il méta-agrège plusieurs sources de cotation indépendantes et classe les routes par **meilleur retour net** (frais d'agrégateur + frais de pool + impact de prix).

**Lecture seule** — il *recommande* la meilleure route ; il ne signe ni ne soumet aucune transaction. L'exécution se fait dans votre propre wallet. **La clé privée n'est jamais demandée ni manipulée.**

## Prérequis

- **Docker** — pour le déploiement auto-hébergé (collecteur + tableau de bord web)
- **Node ≥ 24** — pour le développement local (le collecteur utilise `node:sqlite` ; développé et testé sous Node 26)

## Quickstart — auto-hébergement avec Docker

```bash
cp .env.example .env        # ajuster si besoin (clé Soroswap optionnelle, chemin données, etc.)
docker compose build
docker compose up -d
# Interface web : http://localhost:8080
```

Deux services démarrent :
- **collector** — cote périodiquement BLND→USDC/EURC et persiste les résultats dans SQLite (données historiques, rétention à paliers)
- **web** — simulateur live + tableau de bord servi sur le port 8080

### Chemin des données configurable

Définir `DECANTFI_DATA` dans votre `.env` pour contrôler l'emplacement de la base sur l'hôte :

```bash
DECANTFI_DATA=./data                          # défaut (relatif au dépôt)
DECANTFI_DATA=/docker/decantfi/backend/data   # exemple : NUC / serveur
```

## CLI (développement / scripting)

```bash
npm install
npm run quote -- 1000 USDC              # meilleure route BLND -> USDC pour 1000 BLND
npm run quote -- 1000 EURC              # vers EURC : direct vs via-USDC, le meilleur net est retenu
npm run quote -- 1000 USDC --split      # analyse de fractionnement (25/50/100 %)
npm run quote -- 500 USDC --slippage 30 # tolérance 0,3 % (30 bps)
npm run quote -- 1000 USDC --json       # sortie JSON brute (pour scripts)
```

Options : `--from <ASSET>` (défaut BLND), `--slippage <bps>` (défaut 50), `--split`, `--json`, `--balance` (cote la balance BLND live du wallet au lieu d'un montant fixe), `--help`.

Sortie : tableau classé par **net reçu** (frais d'agrégateur + frais de pool + impact de prix), ligne de recommandation, plancher Horizon (valeur ajoutée des agrégateurs), et pour EURC le duel direct / via-USDC. **Rien n'est signé ni soumis** — l'exécution se fait dans votre wallet.

## Config (`.env`, tout optionnel)

- `SOROSWAP_API_KEY` — non requis (Soroswap tourne en keyless via `soroswap-router-sdk` local).
- `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` — surchargent les endpoints publics par défaut.
- `WALLET_ADDRESS` — adresse **publique** uniquement (jamais de clé privée). Non requise pour les cotations ; réservée à l'affichage futur de la position Blend.
- `DECANTFI_DATA` — répertoire des données sur l'hôte (défaut `./data` ; ex. `/docker/decantfi/backend/data` sur un NUC).
- `IMAGE_OWNER` — propriétaire de l'image GHCR (défaut `actarus314` ; mettre votre compte si vous forkez).

## Sources de cotation

xBull, Aquarius, Soroswap, StellarBroker, Ultra Stellar (StellarTerm), Horizon, et une sonde directe du pool Comet (BLND/USDC) — interrogées **en parallèle** et **tolérantes aux pannes** (une source indisponible ne bloque pas le classement).

## Collecteur (Phase 2)

Daemon de logging : cote BLND→USDC/EURC périodiquement (sondes **250/750 BLND**) et persiste chaque mesure dans SQLite avec **rétention à paliers** (raw 90 j → structuré 1 an → rollup horaire).

```bash
npm run collector          # daemon (scheduler interne, cadence .env, défaut 15 min)
npm run tick:once          # un tick réel → DB + résumé console
npm run history            # journal des derniers ticks (gagnant par sonde)
npm run export -- csv      # export CSV (ou : npm run export -- json)
```

Clés `.env` du collecteur : `COLLECTOR_CADENCE_SEC`, `COLLECTOR_SIZES_BLND`, `COLLECTOR_PAIRS`, `COLLECTOR_DB_PATH`, `RAW_RETENTION_DAYS`, `ROLLUP_AFTER_DAYS`.

**Production (Docker) :** épingler `IMAGE_TAG` dans `.env` (jamais `:latest`) ; image publiée sur ghcr.io via CI sur tag `v*`. Lancer `trivy image` avant la mise en prod.

## Limites connues (v1)

- **Slippage par leg (EURC via-USDC)** : `--slippage` n'est pas réparti entre les 2 legs. Sans effet en v1 (seul StellarBroker consomme ce paramètre) ; à implémenter quand l'exécution multi-leg arrivera.
- **Soroswap keyless** : route sur la **paire directe** uniquement. Le multi-hop complet nécessiterait la clé API ou plus de paires ; la méta-agrégation des autres sources compense.
- **Prix spot** : récupérés via DefiLlama (impact de prix indicatif) ; si indisponible, la colonne Δspot s'efface — le classement par net reste valable.
- **EURC direct ≈ via-USDC** : quand la même source gagne les deux, les nets sont identiques — il n'existe pas de marché BLND/EURC indépendant. L'outil signale ce cas explicitement.
- **Comet** : sonde read-only du pool (BLND↔USDC) via un compte témoin ; peut se retirer pour de très gros montants (solde du témoin).

## Développement

```bash
npm test           # tests unitaires (adapters figés sur fixtures réelles, normalisation, classement, collecteur, DB…)
npm run typecheck
```

## Structure

- `core/` — moteur pur réutilisable : adapters de sources, normalisation en net réel, classement, analyse de fractionnement, logique EURC, gas, prix, lecture de balance.
- `cli/` — interface ligne de commande (cotation + journal).
- `collector/` + `db/` — daemon de logging des quotes + base SQLite (Phase 2 : historique, rétention).
- `web/` — UI self-hosted (simulateur live + graphe Sankey des routes + tableau de bord historique).

## Licence

GPL-3.0-or-later — voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les règles de contribution.
