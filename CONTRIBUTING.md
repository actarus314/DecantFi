# Contributing to decant.fi / stellar-swap

**English** · [Français ci-dessous](#contribuer-à-decantfi--stellar-swap)

---

## Dev setup

```bash
git clone https://github.com/actarus314/stellar-swap.git
cd stellar-swap
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

## Branch and PR process

1. Fork or branch from `main`.
2. Name branches descriptively: `feat/my-feature`, `fix/issue-42`, `chore/update-deps`.
3. Keep commits atomic and the message clear ("why", not just "what").
4. Open a PR against `main`. Title ≤ 70 characters.
5. All CI checks (typecheck, tests, Docker build) must pass.
6. One approval required before merge.

## Bilingual documentation rule

**All GitHub-facing content must be available in both French and English.**

- `README.md` — English (GitHub default landing page)
- `README.fr.md` — French
- `CONTRIBUTING.md` — both languages in one file (English first, then French, separated by `---`)

When you update documentation, update **both** language versions.

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

## Contribuer à decant.fi / stellar-swap

[English above](#contributing-to-decantfi--stellar-swap) · **Français**

---

## Environnement de développement

```bash
git clone https://github.com/actarus314/stellar-swap.git
cd stellar-swap
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

## Processus de branche et PR

1. Forker ou brancher depuis `main`.
2. Nommer les branches de manière explicite : `feat/ma-feature`, `fix/issue-42`, `chore/update-deps`.
3. Garder les commits atomiques avec un message clair (le « pourquoi », pas seulement le « quoi »).
4. Ouvrir une PR contre `main`. Titre ≤ 70 caractères.
5. Tous les checks CI (typecheck, tests, build Docker) doivent passer.
6. Une approbation requise avant merge.

## Règle de documentation bilingue

**Tout contenu public GitHub doit être disponible en français ET en anglais.**

- `README.md` — anglais (page d'accueil GitHub par défaut)
- `README.fr.md` — français
- `CONTRIBUTING.md` — les deux langues dans un seul fichier (anglais d'abord, puis français, séparés par `---`)

En cas de mise à jour de la documentation, mettre à jour **les deux** versions linguistiques.

## Règle zéro-secret

**Ne jamais committer de secrets.**

- `.env` est dans `.gitignore` — ne jamais l'ajouter à un commit.
- Clés API, clés privées, credentials RPC ne doivent apparaître dans aucun fichier commité.
- Seul `.env.example` est commité, avec des valeurs vides ou des placeholders évidents.
- Les clés privées de wallet ne sont **jamais** acceptées par ce code — la signature est côté wallet uniquement.

## Licence

Ce projet est sous licence **GNU General Public License v3.0 ou ultérieure** (GPL-3.0-or-later).

En contribuant, vous acceptez que vos contributions soient soumises aux mêmes termes.
