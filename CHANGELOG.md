# Changelog

All notable changes to DecantFi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Flow-map readability.** The route map's tail threshold drops from 3% to 2%, so fewer routes
  get folded into "Others". The aggregated "Others" row no longer shows a fabricated single route
  (it now reads "—", like its margin). Trend arrows encode magnitude: a single arrow (▲/▼) for a
  light move, a doubled one (▲▲/▼▼) for a strong shift in win frequency (≥10 points between the two
  halves of the window); the backend exposes the signed magnitude (`trendMag`) so the table can
  tell them apart. Win frequencies below 1% now read "<1 %" instead of a misleading "0 %". When a
  single route is highlighted, its thread now nests inside its parent band instead of spilling
  below it (the partial-highlight offset uses the drawn band's local scale, not the full-flow one).

## [0.2.10] - 2026-06-25

### Added
- **Pre-signature guard against insufficient XLM for network fees.** A route's *declared*
  `max_fee` is locked by the network at submission — and for Soroban routes (xBull especially) it
  can be large because of a worst-case fee reservation. When it exceeds the wallet's spendable XLM
  (balance minus reserve), the review popup now shows a clear, blocking red message and disables
  the sign button, instead of letting the user hit an opaque "execution source unavailable" at
  signature.
- **High network-fee warning in the review popup.** When a Soroban route's real network fee is
  unusually high — because the route must extend the TTL of shared on-chain state ("rent") — the
  fee value turns amber with an explanatory tooltip. Non-blocking: the cost is periodic, not
  per-swap, and the reserved surplus is refunded. Classic routes (Horizon/Ultra/StellarBroker)
  never trigger it.

## [0.2.9] - 2026-06-25

### Fixed
- **Swap review popup now honors the selected tool.** For BLND→EURC, picking any venue opened
  that venue's verification/execution flow as displayed, but the action always started the
  composite 2-tx (via-USDC) flow. Render and action now share one decision (`chooseExec`), so the
  displayed target always equals the executed one.

### Added
- **Freighter simulation notice** in the pre-signature review popup. Only when connected via
  Freighter *and* routing through Horizon or Ultra Stellar, a note explains that Freighter's
  screen shows the guaranteed minimum (`destMin`) for these classic path-payment routes — not the
  expected amount above. Soroban swaps (xBull/Soroswap/Comet/Aquarius) simulate correctly, so the
  notice is scoped to the affected case.

## [0.2.8] - 2026-06-25

### Added
- **Optional GoAccess traffic dashboard** (`monitoring` Compose profile). The web service always
  writes an nginx COMBINED access log (to stdout, and to a size-capped, self-rotating file);
  enabling the profile starts GoAccess to regenerate an auto-refreshing HTML dashboard and serve
  it on a dedicated host port. One switch: `docker compose --profile monitoring up` (or set
  `COMPOSE_PROFILES=monitoring`). Publish it behind your reverse proxy with authentication —
  never expose it publicly without auth. Tunables in `.env`: `ACCESS_LOG_MAX_MB`,
  `GOACCESS_REFRESH_SEC`, `GOACCESS_PORT`.

### Changed
- CI: pre-release tags (`vX.Y.Z-beta.N`) are no longer published as `:latest`; only final
  releases get `:latest`. Documented `COMPOSE_PROFILES`.

## [0.2.7] - 2026-06-25

### Security
- **Anti-scraping guard on `/api/*`**: every request must come from a same-origin browser
  context (`Sec-Fetch-Site`) or a loopback caller (the Docker healthcheck); direct programmatic
  access (curl, scripts, scrapers, AI crawlers) is rejected with 403. The public dashboard is
  unaffected. Added `robots.txt` (`Disallow: /api/`).
- **Wallet-connect icons are now self-hosted** instead of fetched from a third-party origin at
  runtime; CSP `img-src` tightened to `'self' data:`. The bundle build vendors and rewrites the
  icon URLs automatically on every rebuild (adapts to new wallets).
- Added `Cross-Origin-Opener-Policy: same-origin-allow-popups`, `Cross-Origin-Resource-Policy:
  same-origin`, and a restrictive `Permissions-Policy`.
- A blocked request emits a `BLOCK` log line (status, reason, path, IP, user-agent) for
  monitoring. The 403 body and `robots.txt` carry an open-source notice inviting scrapers to run
  their own instance and reach out via a GitHub issue.

### Fixed
- `/api/overview` is now cached per `pair|tzoff` (the previous single-slot cache was busted by
  rotating the `tzoff` parameter, forcing a DB recompute on every request).

### Changed
- Documented `STELLARBROKER_API_KEY` and `TRUST_PROXY` in `.env.example`, the README config
  table, and the FAQ; aligned README/FAQ with the current hardening and StellarBroker (active
  WebSocket quote source).
- CI: `test` and `security` run on pull requests only (they gate the merge); release tags trust
  that gate and no longer re-run the suite.

## [0.2.6] - 2026-06-24

### Security
- Hardened the public web server (generalist, safe defaults, no infra assumptions):
  - Rate-limit previously unguarded endpoints that hit Horizon/RPC: `/api/balance` and
    `/api/asset-balance` (60/min), `/api/build-trustline` and `/api/submit` (10/min).
  - Opt-in `TRUST_PROXY` (default off) with spoof-safe client-IP extraction (`X-Real-IP`,
    then the rightmost `X-Forwarded-For` element); every rate limit is keyed on the real client IP.
  - Sanitized client-facing execution error messages — raw SDK/upstream text now goes to
    stderr only; clients receive a static per-code message (public Horizon `result_codes` kept).
  - `X-Content-Type-Options: nosniff` on all JSON responses.
  - `server.requestTimeout` (anti-slowloris on the request body).
  - Request logging drops the query string (no wallet addresses in logs).
  - Malformed percent-encoded query parameters now return 400 instead of 500.

## [0.2.5] - 2026-06-24

### Added
- StellarBroker re-enabled as a quote source via its **authenticated WebSocket**
  (`wss://api.stellar.broker/ws?partner=<key>`). The API key is WS-only — the keyless REST
  endpoint remains Cloudflare-rate-limited. Quotes are classed on the estimate
  (`estimatedBuyingAmount`) with the realizable SDEX floor shown in the quote detail, since
  StellarBroker's best price is only reachable through its own execution layer.
- **"Execute floor (SDEX)"** action on the StellarBroker row: runs the full execution flow
  at the realizable floor (a Horizon-equivalent strict-send), because routing it yourself
  yields approximately the floor, not the estimate.

### Fixed
- Collector now forwards the StellarBroker API key per tick, so StellarBroker is collected
  automatically — not only in manual/live quotes.
- StellarBroker's identity card now shows its fee (opaque, per-partner) and simulation
  status (off-chain RFQ, not on-chain simulated); its note no longer says "classed on the
  floor."

### Changed
- Release CI builds and publishes images only on version tags (`:X.Y.Z` + `:latest`); the
  unused `:edge` image and the redundant main-push test run were removed.

## [0.2.4] - 2026-06-24

### Added
- Source identity cards now show, per tool, the fee it takes (aggregator skim vs pool fee
  vs SDEX) and whether its quote is fully simulated, re-simulated, or not — with the
  reason. Comet's pool fee confirmed on-chain at 0.30%.
- Phoenix AMM quote adapter (Soroban `simulate_swap`), validated on-chain but kept
  inactive: Phoenix has no BLND pool, so it is inert for DecantFi's routes.
- This CHANGELOG, reconstructed from v0.1.0.

## [0.2.3] - 2026-06-23

### Security
- Removed `script-src 'unsafe-inline'` from the Content-Security-Policy. The inline app
  script moved to `/app.js`, event handlers use delegation (`data-act`), and version
  metadata is read from `<meta>` tags.
- Hardened the container `/tmp` mount with `noexec,nosuid,nodev,size=64m`.

### Changed
- Soroban swaps now submit fire-and-poll: the transaction hash returns immediately and the
  client polls `/api/tx-status`, instead of blocking after signature. A slow ledger close
  no longer looks like a failed swap.
- Theme toggle updates in place instead of re-rendering the whole page.

### Fixed
- Release CI skips release creation when a release already exists for the tag (idempotent).
- `pickExecutableVenue` test is now hermetic (injected `simulateXbullNet`), removing a
  network-dependent flaky timeout in CI.

## [0.2.2] - 2026-06-23

### Changed
- Stability page lists only active adapters; the disconnected StellarBroker is no longer shown.

### Fixed
- Collector no longer freezes on a hung re-simulation: per-call timeouts plus a per-tick watchdog.
- Each re-simulation is bounded at the call site, so a slow venue degrades to an estimate
  instead of blocking the whole quote.
- Stability page shows "overdue" instead of a frozen "imminent" when the collector is stale.
- Aquarius confidence is promoted to "exact" on any successful re-simulation, not only when
  the value changes.
- Stability day-dots pinned left; added a tooltip to the Coherence column.

## [0.2.1] - 2026-06-23

Hardening batch from the first full-repo code review.

### Changed
- Collapsed the duplicate venue-name tables in statistics into one.

### Fixed
- Web server no longer crashes on a malformed request URL; the rate-limit map is bounded;
  the RPC meter is isolated per request.
- Aquarius is ranked on its real simulated fill, with confidence promoted after a successful
  re-simulation.
- EURC composite restricted to BLND sells; floor source widened to Ultra Stellar.
- Collector guards: `rawRetention=0`, clamped jitter, wallet-address loading, re-sim error counting.
- xBull missing-hash guarded; added coverage for sensitive XDR paths.
- CLI: slippage validation, clearer `--balance` error, Δspot flagged as unreliable for
  non-BLND sells, deduplicated env loading.
- Web UI: resolved a chip/health label clash, escaped the onclick asset, localized notes and margins.
- Cached prepared DB statements and closed a stale rpc-log connection.

## [0.2.0] - 2026-06-23

### Changed
- Configuration is single-sourced in `.env`; the compose file no longer carries inline
  defaults. The footer now stamps the running version and commit.
- Docker image rebased on Alpine: roughly 96 MB / 28% smaller.

### Fixed
- Resolved `.env`/compose coherence gaps found during the audit.

## [0.1.1] - 2026-06-23

### Added
- Community health files: Code of Conduct, security policy, issue and pull-request templates.

### Security
- Completed backslash escaping in the ladder `onclick` (CodeQL finding).
- Excluded the vendored bundle from CodeQL analysis.

## [0.1.0] - 2026-06-23

Initial public release.

### Added
- Read-only meta-aggregator that finds the best **net** route to swap BLND → USDC/EURC
  across verified Stellar sources, ranked by the amount actually received.
- CLI (`npm run quote`) that recommends routes without signing or submitting anything.
- Self-hosted Docker web app: a history collector (periodic probes into SQLite) and a live
  simulator. Swap execution is performed entirely through the user's wallet signature — the
  private key is never handled by the app.
- Sources: xBull, Aquarius, Soroswap, Ultra Stellar / StellarTerm, Horizon strict-send, and Comet.
- EURC routing, including the 2-transaction composite via USDC when it yields a better net.
- Each venue is ranked on its real simulated fill, not its raw quote.
- Custom zero-dependency Sankey route visualization and a 4-language UI (English, French,
  Spanish, Brazilian Portuguese).

[Unreleased]: https://github.com/actarus314/DecantFi/compare/v0.2.7...HEAD
[0.2.7]: https://github.com/actarus314/DecantFi/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/actarus314/DecantFi/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/actarus314/DecantFi/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/actarus314/DecantFi/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/actarus314/DecantFi/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/actarus314/DecantFi/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/actarus314/DecantFi/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/actarus314/DecantFi/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/actarus314/DecantFi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/actarus314/DecantFi/releases/tag/v0.1.0
