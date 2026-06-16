// Point d'entrée bundlé pour le client (self-host). esm.sh/jsdelivr cassent les sous-chemins
// /modules/* de stellar-wallets-kit 2.3.0 (résolution tweetnacl) → on bundle localement.
// Régénérer : npm run build:walletkit  (génère web/public/walletkit.js, versionné).
export { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
export { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
export { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
export { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
export { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
export { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';
export { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
