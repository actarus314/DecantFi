// Self-hosted bundle for the StellarBroker Mediator execution flow.
// ⚠ SECURITY: this path holds funds in transit, so every transaction the SDK
//   streams is validated against a strict allowlist by our validateStreamedTx
//   guard — run in the socket TAP before the ephemeral key signs (defense in
//   depth). The SDK version is pinned for a reproducible, reviewable bundle;
//   review makeGuardedTap() before changing it. Regenerate: npm run build:sb-mediator

// High-level flow API — app.js imports these (only plain data + XDR strings cross the boundary).
export { executeSbMediatorSwap, makeGuardedTap, hasObsoleteMediators, disposeObsoleteMediators } from './sb-mediator-flow.js';

// Low-level exports retained for tooling / spike code that imports the bundle directly.
export { StellarBrokerClient, Mediator } from '@stellar-broker/client/src/index.js';
export { validateStreamedTx, SB_ROUTER_CONTRACT, SB_FEE_ACCOUNT } from '../core/sources/stellarbroker-guard';
