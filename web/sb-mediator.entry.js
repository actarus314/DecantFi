// Self-hosted bundle for the StellarBroker Mediator execution flow.
// ⚠ SECURITY: bundles @stellar-broker/client@0.6.14 — an SDK with a KNOWN
//   fund-drain vulnerability (advisory DECANT-SB-2026-001): its
//   validateTransaction() does NOT validate the Soroban swap path. We pin
//   this exact version DELIBERATELY and neutralise the vuln with our own
//   validateStreamedTx guard, run in the socket TAP before the ephemeral
//   key signs. DO NOT "upgrade" this SDK or trust its own validation.
//   Regenerate: npm run build:sb-mediator
export { StellarBrokerClient, Mediator } from '@stellar-broker/client/src/index.js';
export { validateStreamedTx, SB_ROUTER_CONTRACT, SB_FEE_ACCOUNT } from '../core/sources/stellarbroker-guard';
