[English](FAQ.md) · **Français**

# DecantFi — FAQ

Réponses courtes aux questions qui reviennent quand on utilise ou qu'on fait confiance à DecantFi. Voir le [README](README.fr.md) pour la vue d'ensemble.

## Sécurité & confiance

### DecantFi touche-t-il un jour ma clé privée ?

Non. **Il ne demande jamais, ne stocke jamais et ne manipule jamais une clé privée.** Le CLI est en lecture seule et ne signe rien. Dans l'application web, vous connectez un wallet (Freighter, xBull, Lobstr, Albedo, Rabet, Hana) et **vous signez dans ce wallet** ; le serveur se contente de relayer la transaction que vous avez déjà signée. Avant de la relayer, il vérifie qu'il s'agit d'un swap ou d'une opération trustline — il ne peut pas être détourné en autre chose.

### Est-ce un conseil financier ?

Non. DecantFi est un **recommandeur de route** : il vous indique quelle source vous rapporterait le plus pour un swap donné, à l'instant présent. Il ne prédit pas les prix, ne gère pas de fonds et ne décide pas à votre place. Vérifiez la transaction dans votre wallet avant de signer.

### Qu'est-ce qui est explicitement hors périmètre (modèle de menace) ?

DecantFi est un outil de cotation auto-hébergé en lecture seule. Il **ne custody pas de fonds, ne détient pas de clés et ne déplace pas d'argent en votre nom**. La principale surface de confiance est le relay `/api/submit` — il est durci pour n'accepter que des opérations swap/trustline d'une transaction que vous avez signée, et il n'ajoute **aucune capacité** au-delà de soumettre cette transaction directement à Horizon vous-même. Les sources de cotation sont des tiers ; une source malveillante peut au pire faire paraître sa propre route moins bonne (c'est une voix parmi plusieurs, et le gagnant est re-simulé). L'exposer publiquement est de votre responsabilité — mettez-le derrière un reverse proxy avec TLS.

## Déploiement

### De quoi ai-je réellement besoin pour le déployer ?

Pour la **cotation**, rien d'obligatoire — chaque source a un chemin keyless ou un endpoint public par défaut. Pour **exécuter** des swaps depuis l'application web, c'est votre wallet qui signe ; les clés optionnelles sont `SOROSWAP_API_KEY` (utilisée par le chemin d'exécution pour construire les transactions Soroswap) et `STELLARBROKER_API_KEY` (active StellarBroker comme source de cotation via son WebSocket authentifié ; sans elle, cette source est ignorée). Toutes les clés `.env` sont optionnelles et documentées dans [`.env.example`](.env.example).

### Où sont stockées mes données ?

Dans une base de données SQLite locale. Contrôlez son emplacement sur l'hôte avec `DECANTFI_DATA` (défaut `./data`, ex. `/docker/decantfi/backend/data` sur un serveur). Rien n'est envoyé à un tiers en dehors des requêtes de cotation/RPC elles-mêmes.

### Quel RPC utilise-t-il ? Puis-je utiliser le mien ?

Il utilise un Stellar RPC configurable (`STELLAR_RPC_URL`) avec un fallback public, et Horizon (`STELLAR_HORIZON_URL`). Un fournisseur dédié (ex. Validation Cloud) est recommandé pour la fiabilité sous charge ; l'auto-hébergement de `stellar-rpc` est l'option à long terme. Les endpoints publics fonctionnent pour un usage léger.

### Comment l'exposer à d'autres personnes en toute sécurité ?

Mettez-le derrière un reverse proxy (Caddy ou nginx) terminant le **TLS**, et gardez l'application liée à localhost derrière lui. L'application parle HTTP simple par conception et embarque un rate-limiting par IP ; le reverse proxy ajoute le TLS et est le bon endroit pour tout contrôle d'accès supplémentaire. Derrière un proxy, mettez `TRUST_PROXY=true` et faites transmettre `X-Real-IP` / `X-Forwarded-For` par le proxy, pour que le rate-limiting par IP se base sur l'IP client réelle et non celle du proxy — sinon il s'applique globalement.

### Comment les dépendances sont-elles maintenues à jour ?

Dependabot ouvre des PRs (npm, Docker, GitHub Actions) ; elles sont fusionnées uniquement après que `typecheck` + tests passent — **à jour, mais vérifiées, jamais fusionnées à l'aveugle**. `npm audit --omit=dev` est propre et bloque la CI.

### Comment éviter que les logs des conteneurs grossissent indéfiniment ? Comment monitorer le trafic ?

**Rotation des logs conteneurs** — DecantFi ne livre pas de directives `logging:` dans `docker-compose.yaml` pour ne pas écraser votre configuration du daemon. L'approche recommandée est de basculer le daemon Docker sur le driver moderne `local` une seule fois (dans `/etc/docker/daemon.json` : `{"log-driver":"local"}`) ; il rotate et compresse le stdout de **tous** les conteneurs par défaut. Vous pouvez aussi ajouter un bloc `logging:` à votre propre surcharge compose, par service.

**Monitoring du trafic (dashboard GoAccess optionnel)** — le conteneur `web` émet une ligne au format nginx COMBINED sur stdout par requête. Vous pouvez aussi lui faire écrire un fichier en réglant `ACCESS_LOG=/app/logs/access.log` dans `.env` ; l'application plafonne et rotate le fichier elle-même (`ACCESS_LOG_MAX_MB=50`). Une fois ce fichier en place, démarrez le stack GoAccess optionnel :

```sh
docker compose --profile monitoring up -d
```

Cela démarre deux conteneurs supplémentaires (un générateur de rapport GoAccess et un serveur de fichiers statiques minimal) et publie le dashboard sur `http://hôte:${GOACCESS_PORT}` (défaut `7890`). **Mettez ceci derrière votre reverse proxy avec authentification** — ne l'exposez jamais publiquement sans contrôle d'accès. L'intervalle de rafraîchissement est contrôlé par `GOACCESS_REFRESH_SEC` (défaut 60 s).

## Choix de conception

### Pourquoi le « net » correspond-il au montant brut, avec le gas affiché séparément ?

Parce que c'est ainsi que ça se règle réellement. Les frais de swap et l'impact de prix sont prélevés sur l'asset que vous recevez, ils font donc partie du net. **Le gas est payé en XLM**, séparément, et varie par transaction — votre wallet et tout explorateur de blocs l'affichent à part, DecantFi fait de même. Incorporer un coût XLM fluctuant dans un chiffre USDC/EURC serait moins précis, pas plus.

### Pourquoi EURC a-t-il deux routes ?

Il n'existe pas de marché profond direct BLND/EURC, donc la meilleure sortie vers EURC est souvent **BLND → USDC → EURC** (un composite, deux transactions) plutôt que direct. DecantFi cote les deux et garde celui qui rapporte le plus. Quand la même source gagne les deux, les nets sont identiques et l'outil le dit plutôt que d'inventer une différence.

### Pourquoi deux tailles de sonde (250 et 750 BLND) ?

La route gagnante et l'impact de prix dépendent tous deux de la taille de la transaction — une source qui est la meilleure pour une petite sortie peut perdre pour une plus grande, parce que l'impact de prix croît avec le montant que vous poussez à travers une pool. Sonder à deux tailles représentatives (250 et 750 BLND) montre comment la réponse évolue avec la taille, pour qu'un seul chiffre ne vous induise jamais en erreur. Le simulateur live cote n'importe quel montant que vous saisissez ; le sélecteur 250/750 s'applique au tableau de bord historique.

### Qu'est-ce que le double impact de prix (Local vs EVM) ?

Pour EURC uniquement, l'impact de prix est affiché de deux façons (basculez depuis l'en-tête de colonne). **Local** compare par rapport au prix de l'EURC sur le carnet d'ordres SDEX de Stellar — la bonne référence si vous prévoyez de rester sur Stellar. **EVM** compare par rapport au prix global de l'EURC sur Base/Ethereum — la bonne référence si vous prévoyez de bridger, car la prime ou la décote de Stellar par rapport au prix mondial devient alors un vrai gain ou une vraie perte. USDC est identique dans les deux modes. Positif = vous recevez moins, négatif = vous recevez plus.

### Comment StellarBroker est-il intégré, et pourquoi certaines sources échouent-elles parfois ?

StellarBroker est intégré via son **WebSocket authentifié** (`wss://api.stellar.broker/ws?partner=<clé>`). La clé API est réservée au WebSocket — l'endpoint REST keyless reste soumis au rate-limiting Cloudflare et ignore la clé. Les cotes sont classées sur l'**estimation** (`estimatedBuyingAmount`), avec le plancher SDEX réalisable affiché dans le détail de la cote, car le meilleur prix de StellarBroker n'est atteignable qu'à travers sa propre couche d'exécution (un split multi-routes) ; router vous-même donne environ le plancher. Les frais de StellarBroker sont **opaques** (prélevés on-chain à l'exécution, par partenaire ; non divulgués dans la cote), et sa cote n'est **pas simulée on-chain** — c'est un RFQ off-chain via WebSocket. D'autres sources peuvent échouer de façon transitoire (timeouts, problèmes d'endpoint) ; c'est attendu, et l'agrégateur est conçu pour classer correctement même sans l'une d'elles.

### Pourquoi garder une dépendance GPL / un routage keyless ?

DecantFi lit les réserves des pools **on-chain et sans clé** partout où c'est possible (ex. Soroswap via `soroswap-router-sdk`), plutôt que de dépendre d'une API hébergée avec clé. Pour un outil dont tout l'objectif est de vous dire la vérité sur un swap et de continuer à fonctionner quand un service est hors ligne, la vérité on-chain est le meilleur fondement — c'est pourquoi le projet est sous GPL-3 et conserve cette dépendance.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour l'installation, les tests et les conventions.
