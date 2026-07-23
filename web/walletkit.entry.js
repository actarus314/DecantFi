// Bundled entry point for the client (self-host). esm.sh/jsdelivr break the /modules/*
// sub-paths of stellar-wallets-kit 2.3.0 (tweetnacl resolution) → bundle locally instead.
// Regenerate: npm run build:walletkit  (generates web/public/walletkit.js, versioned).
export { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
export { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
export { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
export { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
export { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
export { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';
export { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
