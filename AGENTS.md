# AGENTS.md — instructions for coding agents

Read this before changing anything in this repository.
This file follows the [AGENTS.md](https://agents.md) convention and is read by most coding
agents. Claude Code reads it through the import in `CLAUDE.md` (local, untracked).

## Project

- **What it is**: DecantFi — a self-hosted, non-custodial tool that finds the best net route to
  swap BLND into USDC or EURC on Stellar, by cross-checking several independent quote sources and
  ranking them on what would actually be received.
- **Stack**: Node.js (>= 24) / TypeScript, Vitest, esbuild. `@stellar/stellar-sdk`,
  `@soroswap/sdk`, `soroswap-router-sdk`, `@stellar-broker/client` for Stellar/Soroban access.
  SQLite (`node:sqlite`) for the collector's history. A self-hosted web dashboard + live
  simulator, shipped as a Docker image (`ghcr.io/actarus314/decantfi-collector`).

## Commands

```bash
npm install           # install dependencies
npm run web            # start the web dashboard + live simulator (or: docker compose up -d)
npm run quote -- 1000 USDC   # CLI: best net route BLND -> USDC (read-only, --json for scripts)
npm test               # Vitest unit tests
npm run typecheck       # tsc --noEmit (TypeScript strict check)
```

## Structure

- `core/` — pure engine: adapters, net normalisation, ranking, split, EURC logic, gas, prices.
- `cli/` — read-only command-line entry points (`quote`, `history`); signs and submits nothing.
- `collector/` — quote-logging daemon: periodic BLND -> USDC/EURC probes, persisted to SQLite.
- `db/` — SQLite layer (schema, queries) used by the collector and the web app.
- `web/` — self-hosted dashboard + live simulator; wallet-side transaction signing/execution.
- `scripts/` — build scripts for the vendored browser bundles (`walletkit.js`, `sb-mediator.js`).
- `test/` — shared test helpers (fixture factory, fixture loader).
- `test-fixtures/` — recorded fixtures used by the test suite.
- `data/` — runtime SQLite database (gitignored, not committed).
- `docs/` — documentation assets: screenshots and architecture decision records (`docs/adr/`).
- `spike/` — security PoC code; gitignored, never committed to this public repo.

## Branching

Three stages, because there is a real host to validate against before production.

- `feat/…` — branch off `develop`.
- `develop` — staging. Merged here first, deployed to the staging host, validated there.
- `main` — production. `develop` reaches it through a pull request.

**Keep `develop` short-lived** — merge in days, not weeks. A staging branch that lingers
drifts from `main`, and that is precisely how an environment branch turns into the
anti-pattern it is often accused of being.

A `v*` tag publishes the image to ghcr. Whoever deploys it runs a **pinned tag**
(`X.Y.Z`), never `:latest` and never a branch: what gets promoted is the **artifact**,
not the branch. The tag is immutable (a ruleset enforces it), so a pinned deployment
cannot silently change under the host.

## Conventions

- **Everything committed is written in English** — code, code comments, docs, `README.md`,
  `.env.example`. The only exception is `README.md`, which is bilingual (English, then French).
- **Never use the second person** (`you`/`your`) in committed content or in the app's UI.
  Write "the user", or use impersonal phrasing.
- **i18n**: translations live in a separate dictionary — never inline ternaries in the markup.
- **`CHANGELOG.md`**: update the `Unreleased` section for any user-facing change. The GitHub
  Release carries the auto-generated list of merged pull requests; the changelog says what
  actually changed for a user.
- **Architecture decisions**: a non-trivial decision (stack, schema, boundary) gets a short
  record in `docs/adr/`. The point is to preserve the *why*, which the code cannot express.

## While the repository is PRIVATE — the rules are NOT enforced by the server

A private repository on a Free plan has **no rulesets**: every check below still runs, but
**none of them is required** — GitHub would accept a direct push to `main`, or the merge of a
red pull request. The safety net is local, and partly human.

- **Never merge a pull request whose CI is not green.** Nothing on the server prevents it.
  Check first, every time:

  ```bash
  sha=$(gh pr view <n> --json headRefOid --jq .headRefOid)
  gh run list --commit "$sha"
  ```

  **Green means: every EXPECTED workflow is `completed / success`** — `CI`, plus `Publish image`
  when `docker-publish.yml` exists, plus **`CodeQL` once the repository is public** (it does not
  run while private: Advanced Security is unavailable there). **A workflow MISSING from that list
  is not a green**: it has simply not reported yet. "Nothing is red" and "everything is green" are
  not the same claim, and the gap between them is exactly where a broken change slips into `main`.

  > ⚠️ **Match on `workflowName`, never on `name`.** CodeQL runs through GitHub's *default setup*,
  > so it has no workflow file in the repository: its run is `dynamic`, and its `name` field reads
  > `Push on main` — the run's *title*, not the workflow's. Only `workflowName` says `CodeQL`.
  > A check filtering on `name` would never see CodeQL at all, and would call the pull request
  > green while the security analysis had not reported.
  >
  > ```bash
  > gh run list --commit "$sha" --json workflowName,status,conclusion
  > ```

  > `gh pr checks` cannot be used here. It reads `statusCheckRollup`, which needs the `Checks`
  > permission — and that permission **does not exist** in the fine-grained token UI, so it cannot
  > be granted (github/community#129512). The command above needs only `Actions: read`, which the
  > repository token already has.

- **Never push straight to `main` or `develop`.** The `pre-push` hook refuses it; that hook is
  the stand-in for the ruleset that does not exist yet. Work through a pull request, always.
- These constraints **disappear on their own** when the repository goes public: the rulesets
  then require the checks, and the server enforces what discipline alone was holding.

> This is the failure mode these rules close: a config regression no build step catches reaches
> `main`, ships as `:latest`, and a host pulls it before anyone notices.

## Checks that run

- **pre-commit hook** — `gitleaks` on staged files (a commit carrying a secret is rejected), then a
  throttled, CONSULTATIVE replay of `./check.sh` (≤ once / 24 h) — it surfaces drift, never blocks.
- **pre-push hook** — refuses a direct push to `main` / `develop` (the missing ruleset).
  Both hooks: a fresh clone must re-arm them once: `git config core.hooksPath .githooks`.
- **`./check.sh`** — replays the CI's security checks locally at the pinned versions, so `local == github`.
- **CI** (`ci.yml`, job `checks`, on every pull request and required before merge) — a dependency
  review (blocks on a high-severity advisory; PR-only, and dormant while the repo is private, same
  as CodeQL below), `npm test` (Vitest) and `npm run typecheck`, a checksum check on the vendored
  `web/public/walletkit.js` bundle, `gitleaks` over the *full* history, `actionlint` + `zizmor` on
  the workflows, `semgrep` static analysis, `osv-scanner` on every manifest it discovers (`-r .`;
  CI-only tooling is out of scope via `.gitignore`).
- **`docker-publish.yml`** — job `build-check` (pull requests into `main` and `develop`): builds
  the Docker image and scans it with **Trivy** (pinned + checksum-verified), failing on any
  CRITICAL/HIGH vulnerability with a known fix. Job `build-push` (on a `v*` tag push): builds and
  pushes the multi-arch (`amd64` + `arm64`) image to `ghcr.io/actarus314/decantfi-collector`,
  tagged with the semver version (plus `latest` for a non-prerelease tag). Job `release`
  (`needs: build-push`, on the same tag push): creates the GitHub Release with auto-generated
  notes (idempotent: re-pushing the same tag or re-running does not fail). It lives here, not in
  a separate `release.yml`, precisely because `needs` cannot cross workflows — the Release must
  wait for the image push.
- **CodeQL** — security analysis; a finding blocks the merge.

## Do not touch

- `web/public/walletkit.js` (+ `.sha256`) — vendored bundle of `@creit.tech/stellar-wallets-kit`;
  regenerate with `npm run build:walletkit`, never hand-edit (see `CONTRIBUTING.md`).
- `web/public/sb-mediator.js` (+ `.sha256`) — vendored bundle of `@stellar-broker/client`;
  regenerate with `npm run build:sb-mediator`, never hand-edit.
- `web/public/version.js` — generated at build time; gitignored, never commit it.
- `spike/` — security PoC code; gitignored, never committed to this public repo.
- Never commit a secret. `.env` and `.envrc` are untracked, and must stay that way.
