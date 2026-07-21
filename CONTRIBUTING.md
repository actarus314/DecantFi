# Contributing to DecantFi

**English** · [Français ci-dessous](#contribuer-à-decantfi)

---

## Dev setup

```bash
git clone https://github.com/actarus314/DecantFi.git
cd DecantFi
cp .env.example .env   # all variables are optional for local dev
npm install
```

Requirements: **Node ≥ 24** (the collector uses `node:sqlite`; developed on Node 26).

### Run tests and type-check

```bash
npm test           # Vitest unit tests (328 tests — must stay green)
npm run typecheck  # TypeScript strict check — must pass with zero errors
```

Both must be green before opening a PR.

### Project layout

- `core/` — pure engine (adapters, normalisation, ranking, EURC logic, gas, prices)
- `cli/` — CLI entry points
- `collector/` + `db/` — quote-logging daemon + SQLite layer
- `web/` — self-hosted web UI (server + static assets)

## Before opening a PR

- For anything non-trivial, open an issue first to discuss the approach.
- Run it locally and check the change actually works.
- No new dependencies for what a few lines of code can do.

## Branch and PR process

Three stages, because there is a real staging host to validate against before production.

- `feat/…` branches off `develop`, not `main`.
- `develop` is staging: merged there first, deployed to the staging host, validated there.
- `main` is production: `develop` reaches it through a pull request.

**Keep `develop` short-lived** — merge in days, not weeks. A staging branch that lingers drifts
from `main`, and that is exactly how an environment branch turns into the anti-pattern it's often
accused of being.

A `v*` tag publishes the `decantfi-collector` image to ghcr. Whoever deploys it runs a **pinned
tag** (`X.Y.Z`), never `:latest` and never a branch — what gets promoted is the artifact, not the
branch.

1. Name branches descriptively: `feat/my-feature`, `fix/issue-42`, `chore/update-deps`.
2. Keep commits atomic and the message clear ("why", not just "what").
3. Open a PR against `develop`. Title ≤ 70 characters.
4. All CI checks (typecheck, tests, Docker build) must pass.
5. One approval required before merge.

**CI must be green before a merge.** Check it:

```bash
sha=$(gh pr view <n> --json headRefOid --jq .headRefOid)
gh run list --commit "$sha" --json workflowName,status,conclusion
```

Green means **every expected workflow is `completed` / `success`** — `CI`, `Publish image`, and
`CodeQL`. A workflow **missing** from the list is **not** a green: it has not reported yet.

⚠️ **Match on `workflowName`, not on `name`.** CodeQL runs through GitHub's *default setup*, so it
has no workflow file: its `name` reads `Push on main` — the run's title. Only `workflowName` says
`CodeQL`.

## Bilingual documentation rule

**All GitHub-facing content must be available in both French and English.**

- `README.md` — English (GitHub default landing page)
- `README.fr.md` — French
- `CONTRIBUTING.md` — both languages in one file (English first, then French, separated by `---`)

When you update documentation, update **both** language versions.

## Language conventions

- **Code, comments, commit messages, PR titles & descriptions, and the changelog are written in English.**
- **User-facing docs** (README, FAQ) are **bilingual** (French + English), per the rule above.

## Vendored bundle: walletkit.js

`web/public/walletkit.js` is a **vendored bundle** of `@creit.tech/stellar-wallets-kit`, built with esbuild from `web/walletkit.entry.js`. It is committed to the repository and tracked by Dependabot.

After upgrading that dependency:

1. Run `npm run build:walletkit` — this regenerates `web/public/walletkit.js` and `web/public/walletkit.js.sha256`.
2. Commit **both** files together.
3. **Re-test the wallet in a browser** (connect + sign a transaction) before opening the PR.

The CI `security` job verifies the committed bundle matches its recorded checksum (`sha256sum -c web/public/walletkit.js.sha256`). Any mismatch will block the build.

## Zero-secret rule

**Never commit secrets.**

- `.env` is git-ignored — never add it to a commit.
- API keys, private keys, RPC credentials must never appear in any committed file.
- Only `.env.example` is committed, with blank or obviously-placeholder values.
- Private keys for wallets are **never** accepted by this codebase — signing is wallet-side only.

## License

This project is licensed under the **GNU General Public License v3.0 or later** (GPL-3.0-or-later).

By contributing, you agree that your contributions will be licensed under the same terms.

---

## Contribuer à DecantFi

[English above](#contributing-to-decantfi) · **Français**

---

## Environnement de développement

```bash
git clone https://github.com/actarus314/DecantFi.git
cd DecantFi
cp .env.example .env   # toutes les variables sont optionnelles en dev local
npm install
```

Prérequis : **Node ≥ 24** (le collecteur utilise `node:sqlite` ; développé sous Node 26).

### Lancer les tests et la vérification de types

```bash
npm test           # tests unitaires Vitest (328 tests — doivent rester verts)
npm run typecheck  # vérification TypeScript stricte — zéro erreur requise
```

Les deux doivent être verts avant d'ouvrir une PR.

### Structure du projet

- `core/` — moteur pur (adapters, normalisation, classement, logique EURC, gas, prix)
- `cli/` — points d'entrée CLI
- `collector/` + `db/` — daemon de logging + couche SQLite
- `web/` — UI web auto-hébergée (serveur + assets statiques)

## Avant d'ouvrir une PR

- Pour tout changement non trivial, ouvrir une issue au préalable pour discuter de l'approche.
- Le lancer en local et vérifier que le changement fonctionne réellement.
- Pas de nouvelle dépendance pour ce que quelques lignes de code peuvent faire.

## Processus de branche et PR

Trois étages, parce qu'il existe un vrai host de staging à valider avant la production.

- `feat/…` part de `develop`, pas de `main`.
- `develop` est le staging : on y merge en premier, on déploie sur le host de staging, on y valide.
- `main` est la production : `develop` l'atteint via une pull request.

**Garder `develop` de courte durée** — merger en jours, pas en semaines. Une branche de staging
qui traîne dérive de `main`, et c'est précisément ainsi qu'une branche d'environnement devient
l'anti-pattern qu'on lui reproche souvent.

Un tag `v*` publie l'image `decantfi-collector` sur ghcr. Qui la déploie tourne un **tag épinglé**
(`X.Y.Z`), jamais `:latest` et jamais une branche — ce qui est promu, c'est l'artefact, pas la
branche.

1. Nommer les branches de manière explicite : `feat/ma-feature`, `fix/issue-42`, `chore/update-deps`.
2. Garder les commits atomiques avec un message clair (le « pourquoi », pas seulement le « quoi »).
3. Ouvrir une PR contre `develop`. Titre ≤ 70 caractères.
4. Tous les checks CI (typecheck, tests, build Docker) doivent passer.
5. Une approbation requise avant merge.

**La CI doit être verte avant un merge.** Vérifier :

```bash
sha=$(gh pr view <n> --json headRefOid --jq .headRefOid)
gh run list --commit "$sha" --json workflowName,status,conclusion
```

Vert signifie **tout workflow attendu en `completed` / `success`** — `CI`, `Publish image`, et
`CodeQL`. Un workflow **absent** de la liste n'est **pas** un vert : il n'a simplement pas encore
rapporté.

⚠️ **Matcher sur `workflowName`, pas sur `name`.** CodeQL tourne via le *default setup* de GitHub,
donc n'a pas de fichier de workflow : son `name` affiche `Push on main` — le titre du run. Seul
`workflowName` indique `CodeQL`.

## Règle de documentation bilingue

**Tout contenu public GitHub doit être disponible en français ET en anglais.**

- `README.md` — anglais (page d'accueil GitHub par défaut)
- `README.fr.md` — français
- `CONTRIBUTING.md` — les deux langues dans un seul fichier (anglais d'abord, puis français, séparés par `---`)

En cas de mise à jour de la documentation, mettre à jour **les deux** versions linguistiques.

## Bundle vendoré : walletkit.js

`web/public/walletkit.js` est un **bundle vendoré** de `@creit.tech/stellar-wallets-kit`, généré avec esbuild depuis `web/walletkit.entry.js`. Il est commité dans le dépôt et suivi par Dependabot.

Après une mise à jour de cette dépendance :

1. Lancer `npm run build:walletkit` — cela régénère `web/public/walletkit.js` et `web/public/walletkit.js.sha256`.
2. Committer **les deux fichiers** ensemble.
3. **Re-tester le wallet au navigateur** (connexion + signature d'une transaction) avant d'ouvrir la PR.

Le job CI `security` vérifie que le bundle commité correspond à son checksum enregistré (`sha256sum -c web/public/walletkit.js.sha256`). Tout écart bloque le build.

## Règle zéro-secret

**Ne jamais committer de secrets.**

- `.env` est dans `.gitignore` — ne jamais l'ajouter à un commit.
- Clés API, clés privées, credentials RPC ne doivent apparaître dans aucun fichier commité.
- Seul `.env.example` est commité, avec des valeurs vides ou des placeholders évidents.
- Les clés privées de wallet ne sont **jamais** acceptées par ce code — la signature est côté wallet uniquement.

## Licence

Ce projet est sous licence **GNU General Public License v3.0 ou ultérieure** (GPL-3.0-or-later).

En contribuant, vous acceptez que vos contributions soient soumises aux mêmes termes.
