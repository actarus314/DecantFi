[English](README.md) · **Français**

<div align="center">

# DecantFi

### BLND swaps — décantés avec précision

Un outil auto-hébergé qui trouve la **meilleure route nette** pour swapper **BLND → USDC ou EURC** sur Stellar, en recoupant plusieurs sources de cotation indépendantes et en les classant sur ce que vous **recevriez réellement**.

Conçu pour les personnes qui sortent de positions [Blend](https://www.blend.capital/) et veulent le vrai chiffre, pas un chiffre optimiste.

![Simulation live DecantFi](docs/img/decantfi-dashboard-fr.png)

</div>

## Pourquoi ça existe

Différentes sources cotent le même swap différemment, et le chiffre affiché en vitrine n'est souvent **pas** ce qui arrive dans votre wallet — les frais, l'impact de prix et le routage le rognent. DecantFi interroge plusieurs sources, **re-simule** les routes qui importent et les classe sur le **montant net reçu**, de sorte que la recommandation reflète le vrai fill plutôt qu'un chiffre de brochure.

Il est délibérément étroit : BLND → USDC/EURC, le swap dont la plupart des utilisateurs de Blend ont réellement besoin. Il fait ça avec soin.

## L'application

### Simulateur live

Saisissez un montant en BLND, appuyez sur **Simulate**, et DecantFi cote chaque source en direct et les classe par sortie nette — la capture d'écran ci-dessus est une vraie exécution `1 000 BLND → USDC`. Les sources sont interrogées **en parallèle** et le simulateur est **tolérant aux pannes** : une source hors ligne ne bloque jamais le classement.

### La confiance, affichée honnêtement

Chaque cote porte un indicateur de confiance, parce que tous les chiffres ne sont pas également fiables :

- **Observé** — un fill réel constaté en simulation live (une route exécutable).
- **Estimé** — un plancher/plafond, ou une route qui n'a pas pu être simulée.
- **Indispo** — source injoignable.

Le classement fait confiance à **Observé** avant **Estimé**, de sorte qu'un chiffre optimiste en vitrine ne l'emporte jamais sur un fill vérifié. C'est le cœur du projet : classer sur le fill réel, pas sur la cote.

### Deux tailles de sonde (250 / 750 BLND)

La route gagnante *et* l'impact de prix dépendent tous deux de la taille de la transaction — une source qui est la meilleure pour une petite sortie peut perdre pour une plus grande. DecantFi sonde à **250 et 750 BLND** pour que le tableau de bord puisse montrer comment la réponse change avec la taille ; basculez entre les deux avec le sélecteur de taille. (Le simulateur live cote n'importe quel montant que vous saisissez.)

### EURC : direct vs composite via-USDC

Il n'existe pas de marché profond direct BLND/EURC, donc la meilleure sortie vers EURC est souvent **BLND → USDC → EURC** — un composite de deux swaps — plutôt que direct. DecantFi cote les deux et conserve celui qui rapporte le plus. Ici, le gagnant est un composite `Comet + Ultra Stellar` routé via USDC :

![Simulation composite EURC](docs/img/decantfi-sim-eurc-composite-en.png)

### Double impact de prix (Local vs EVM)

Pour EURC, l'impact de prix est affiché de deux façons — basculez depuis l'en-tête de colonne :

- **Local** — écart par rapport au prix de l'EURC **sur Stellar** (le carnet d'ordres SDEX). Ce qui compte si vous prévoyez de **rester sur Stellar**.
- **EVM** — écart par rapport au prix **global** de l'EURC (Base / Ethereum). Ce qui compte si vous prévoyez de **bridger**, car la prime ou la décote de Stellar par rapport au prix mondial devient alors un vrai gain ou une vraie perte.

(USDC est identique dans les deux modes.) Positif = vous recevez moins, négatif = vous recevez plus.

### Graphe de routes

Le tableau de bord trace le cheminement de la valeur sur les 7 derniers jours — **la largeur des bandes = fréquence de victoire d'une route**, **couleur = l'outil de swap**, les routes peu fréquentes regroupées dans « Autres ». Aucun chiffre inventé, aucun flux fusionné-mais-incompatible.

![Graphe de routes](docs/img/decantfi-route-graph.png)

### Stabilité des sources

DecantFi est aussi honnête sur sa propre plomberie : une page de stabilité affiche la disponibilité par source et les pannes, ainsi que la santé du Soroban RPC dont il dépend.

![Stabilité des sources](docs/img/decantfi-stability-en.png)

### Thème clair / sombre · quatre langues

Un thème clair et un thème sombre, et une interface disponible en **anglais, français, espagnol et portugais** (détectée automatiquement, commutable).

![Thème sombre](docs/img/decantfi-dark-eurc-en.png)

## Sécurité & sûreté

Gérer les swaps de tierces personnes est une position de confiance, et le projet la traite comme telle.

**Non-custodial par construction.** DecantFi **ne demande jamais, ne stocke jamais et ne manipule jamais votre clé privée.** Le CLI est strictement en lecture seule. Dans l'application web, les transactions sont **signées dans votre propre wallet** (Freighter, xBull, Lobstr, Albedo, Rabet, Hana) ; le serveur se contente de relayer une transaction **que vous avez déjà signée**, et valide qu'il s'agit d'un swap ou d'une opération trustline avant de la relayer — il ne peut jamais être détourné en un autre type de transaction.

![Connexion wallet — signature non-custodiale](docs/img/decantfi-wallet-connect-en.png)

**Durcissement effectué avant l'ouverture du code source** (un audit ciblé, tout sur `main`) :

- **En-têtes web** — Content-Security-Policy, `X-Frame-Options`, `X-Content-Type-Options`, politique de référent ; échappement en sortie sur chaque sink alimenté par l'API.
- **Résistance aux abus** — rate-limiting par IP sur les endpoints quote/build/submit, cooldown de rafraîchissement, plafonds stricts sur les tailles d'entrée, assets et sources sur liste d'autorisation.
- **Hygiène des secrets** — les clés API RPC sont expurgées des logs et de la base de données ; `500` génériques aux clients, détail conservé côté serveur ; **zéro secret** dans le dépôt (scan complet de l'historique git + `gitleaks` en CI).
- **Supply chain** — image de base épinglée par digest, GitHub Actions épinglées par SHA, le seul bundle de navigateur vendoré est livré avec une somme de contrôle et un script de build reproductible, `npm audit` + `gitleaks` bloquent chaque push, et Dependabot maintient les dépendances à jour (vérifiées, jamais fusionnées à l'aveugle).
- **Conteneur** — build multi-étapes, `--omit=dev`, système de fichiers racine `read_only`, capabilities supprimées, `no-new-privileges`.

`npm audit --omit=dev` en production est **propre**. Voir la [FAQ](FAQ.fr.md) pour le modèle de menace et ce qui est explicitement hors périmètre.

## Sources

Interrogées en parallèle, tolérantes aux pannes : **xBull**, **Aquarius**, **Soroswap** (keyless, via le `soroswap-router-sdk` local), **Ultra Stellar** (StellarTerm), **Horizon** strict-send (un plancher fiable), et une sonde directe de la pool **Comet** (BLND/USDC).

> **StellarBroker** est actuellement **déconnecté** : son endpoint keyless est soumis à un rate-limiting sous interrogation automatique répétée. Il reviendra via une intégration authentifiée par clé — voir la [FAQ](FAQ.fr.md).

## Installation — auto-hébergement avec Docker

**Prérequis :** Docker + Docker Compose. (Node ≥ 24 n'est nécessaire que pour le développement local / le CLI ; le collecteur utilise `node:sqlite`, développé et testé sur Node 26.)

```bash
git clone https://github.com/actarus314/DecantFi.git
cd DecantFi
cp .env.example .env          # toutes les clés sont optionnelles — voir le tableau ci-dessous
docker compose build
docker compose up -d
```

Puis ouvrez **http://localhost:8080**.

**Ce qui tourne** — deux services :
- **collector** — cote périodiquement BLND→USDC/EURC (sondes à 250/750 BLND) et persiste chaque mesure dans SQLite, avec une rétention étagée (brut → structuré → rollup horaire).
- **web** — le tableau de bord + simulateur live, sur le port 8080.

**Configuration** (`.env`, toutes les clés sont optionnelles) :

| Clé | Rôle |
|-----|------|
| `DECANTFI_DATA` | Répertoire hôte pour la base de données SQLite (défaut `./data` ; ex. `/docker/decantfi/backend/data` sur un serveur). |
| `SOROSWAP_API_KEY` | Optionnel ; utilisé uniquement par le chemin d'**exécution** pour construire les transactions Soroswap. La cotation est keyless. |
| `STELLAR_RPC_URL` / `STELLAR_HORIZON_URL` | Remplacent les endpoints publics par défaut (un RPC dédié est recommandé sous charge). |
| `COLLECTOR_CADENCE_SEC` · `COLLECTOR_SIZES_BLND` · `COLLECTOR_PAIRS` | Cadence du collecteur (défaut 900 s), tailles de sonde (`250,750`), paires (`USDC,EURC`). |
| `IMAGE_TAG` | Version d'image à déployer ; épingler une version précise en prod, jamais `latest`. |
| `STELLAR_RPC_URL_FALLBACK` | Endpoint RPC de repli pour le failover (basculé au prochain tick si le primaire échoue). |
| `WEB_HOST_PORT` | Port hôte sur lequel publier l'UI web (le conteneur écoute toujours sur 8080). |

**Opérations courantes :**

```bash
docker compose logs -f web          # suivre les logs web
docker compose ps                   # statut des services
docker compose pull && docker compose up -d   # mettre à jour (si image publiée)
# ou, en buildant localement après un git pull :
git pull && docker compose build && docker compose up -d --force-recreate
```

> **Vous l'exposez publiquement ?** Mettez-le derrière un reverse proxy avec TLS (Caddy / nginx) — l'application parle HTTP simple par conception et embarque un rate-limiting par IP ; le proxy ajoute le TLS et est le bon endroit pour tout contrôle d'accès.

## CLI (développement / scripts)

```bash
npm install
npm run quote -- 1000 USDC              # best route BLND -> USDC for 1000 BLND
npm run quote -- 1000 EURC              # to EURC: direct vs via-USDC, best net kept
npm run quote -- 1000 USDC --split      # split analysis (25 / 50 / 100 %)
npm run quote -- 500 USDC --slippage 30 # 0.3 % tolerance (30 bps)
npm run quote -- 1000 USDC --json       # raw JSON (for scripts)
```

Options : `--from <ASSET>` (défaut BLND), `--slippage <bps>` (défaut 50), `--split`, `--json`, `--balance`, `--help`. Le CLI **ne signe et ne soumet rien** — il classe les routes ; l'exécution reste dans votre wallet.

## Limites connues (v1)

- **Slippage par jambe (EURC via-USDC)** n'est pas encore réparti entre les deux jambes — aucun effet en v1 ; arrivera avec l'exécution multi-jambe.
- **Soroswap keyless** route sur la **paire directe** uniquement ; la méta-agrégation des autres sources compense le multi-hop manquant.
- **Le prix spot** provient de DefiLlama (colonne d'impact de prix indicative) ; s'il est indisponible, cette colonne se masque — le classement net reste valide.
- **EURC direct ≈ via-USDC** quand la même source gagne les deux : les nets sont identiques car il n'existe pas de marché BLND/EURC indépendant. L'outil le dit explicitement.
- **Comet** est une sonde de prix de pool en lecture seule via un compte témoin ; elle peut se rétracter pour des montants très importants.

## Développement

```bash
npm test           # tests unitaires — adaptateurs figés sur de vraies fixtures, normalisation, classement, collecteur, BDD
npm run typecheck
```

**Structure du projet :** `core/` (moteur pur : adaptateurs, normalisation net, classement, split, logique EURC, gas, prix) · `cli/` (ligne de commande) · `collector/` + `db/` (daemon de journalisation + SQLite) · `web/` (tableau de bord auto-hébergé : simulateur live + graphe de routes).

## Documentation

- [FAQ](FAQ.fr.md) — sécurité, déploiement, choix de conception, modèle de menace
- [CONTRIBUTING](CONTRIBUTING.md) — installation, tests, conventions

---

> 🥚 Quelque part dans le tableau de bord, DecantFi raconte **un seul mensonge** — magnifiquement, à dessein. Il ne se montre qu'à un code de triche que tout gamer de plus de trente ans connaît par cœur. Bonne chasse.

## Licence

[GPL-3.0-or-later](LICENSE). DecantFi lit les données Stellar on-chain et de façon keyless partout où c'est possible — l'architecture qui convient le mieux à un outil dont tout l'objectif est de vous dire la vérité sur un swap.
