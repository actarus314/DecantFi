# Changelog

All notable changes to DecantFi are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/actarus314/DecantFi/compare/v0.2.4...HEAD
[0.2.4]: https://github.com/actarus314/DecantFi/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/actarus314/DecantFi/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/actarus314/DecantFi/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/actarus314/DecantFi/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/actarus314/DecantFi/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/actarus314/DecantFi/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/actarus314/DecantFi/releases/tag/v0.1.0
