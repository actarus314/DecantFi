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

Pour la **cotation**, rien d'obligatoire — chaque source a un chemin keyless ou un endpoint public par défaut. Pour **exécuter** des swaps depuis l'application web, c'est votre wallet qui signe ; la seule clé optionnelle est `SOROSWAP_API_KEY` (utilisée par le chemin d'exécution pour construire les transactions Soroswap). Toutes les clés `.env` sont optionnelles et documentées dans [`.env.example`](.env.example).

### Où sont stockées mes données ?

Dans une base de données SQLite locale. Contrôlez son emplacement sur l'hôte avec `DECANTFI_DATA` (défaut `./data`, ex. `/docker/decantfi/backend/data` sur un serveur). Rien n'est envoyé à un tiers en dehors des requêtes de cotation/RPC elles-mêmes.

### Quel RPC utilise-t-il ? Puis-je utiliser le mien ?

Il utilise un Stellar RPC configurable (`STELLAR_RPC_URL`) avec un fallback public, et Horizon (`STELLAR_HORIZON_URL`). Un fournisseur dédié (ex. Validation Cloud) est recommandé pour la fiabilité sous charge ; l'auto-hébergement de `stellar-rpc` est l'option à long terme. Les endpoints publics fonctionnent pour un usage léger.

### Comment l'exposer à d'autres personnes en toute sécurité ?

Mettez-le derrière un reverse proxy (Caddy ou nginx) terminant le **TLS**, et gardez l'application liée à localhost derrière lui. L'application parle HTTP simple par conception et embarque un rate-limiting par IP ; le reverse proxy ajoute le TLS et est le bon endroit pour tout contrôle d'accès supplémentaire.

### Comment les dépendances sont-elles maintenues à jour ?

Dependabot ouvre des PRs (npm, Docker, GitHub Actions) ; elles sont fusionnées uniquement après que `typecheck` + tests passent — **à jour, mais vérifiées, jamais fusionnées à l'aveugle**. `npm audit --omit=dev` est propre et bloque la CI.

## Choix de conception

### Pourquoi le « net » correspond-il au montant brut, avec le gas affiché séparément ?

Parce que c'est ainsi que ça se règle réellement. Les frais de swap et l'impact de prix sont prélevés sur l'asset que vous recevez, ils font donc partie du net. **Le gas est payé en XLM**, séparément, et varie par transaction — votre wallet et tout explorateur de blocs l'affichent à part, DecantFi fait de même. Incorporer un coût XLM fluctuant dans un chiffre USDC/EURC serait moins précis, pas plus.

### Pourquoi EURC a-t-il deux routes ?

Il n'existe pas de marché profond direct BLND/EURC, donc la meilleure sortie vers EURC est souvent **BLND → USDC → EURC** (un composite, deux transactions) plutôt que direct. DecantFi cote les deux et garde celui qui rapporte le plus. Quand la même source gagne les deux, les nets sont identiques et l'outil le dit plutôt que d'inventer une différence.

### Pourquoi StellarBroker est-il déconnecté, et pourquoi certaines sources échouent-elles parfois ?

L'endpoint keyless de StellarBroker est derrière Cloudflare et se retrouve soumis à un rate-limiting / blocage IP sous interrogation automatique répétée (la page de stabilité du tableau de bord montre les échecs qui en résultent). Plutôt que de risquer un blocage plus sévère, il est **déconnecté dans l'attente d'une intégration authentifiée par clé** — qui rendra aussi ses frais transparents. D'autres sources peuvent échouer de façon transitoire (timeouts, problèmes d'endpoint) ; c'est attendu, et l'agrégateur est conçu pour classer correctement même sans l'une d'elles.

### Pourquoi garder une dépendance GPL / un routage keyless ?

DecantFi lit les réserves des pools **on-chain et sans clé** partout où c'est possible (ex. Soroswap via `soroswap-router-sdk`), plutôt que de dépendre d'une API hébergée avec clé. Pour un outil dont tout l'objectif est de vous dire la vérité sur un swap et de continuer à fonctionner quand un service est hors ligne, la vérité on-chain est le meilleur fondement — c'est pourquoi le projet est sous GPL-3 et conserve cette dépendance.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour l'installation, les tests et les conventions.
