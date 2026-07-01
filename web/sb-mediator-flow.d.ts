// Type declarations for web/sb-mediator-flow.js (plain ESM, bundled by esbuild).

import type { ValidateExpected } from '../core/sources/stellarbroker-guard.js';

export interface GuardedTapOptions {
  origOnMessage: (ev: MessageEvent) => void;
  expected: ValidateExpected;
  onBlocked: (verdict: { ok: boolean; reason: string }) => void;
}

export function makeGuardedTap(opts: GuardedTapOptions): (ev: MessageEvent) => void;

export interface ExecuteSbMediatorSwapOptions {
  partnerKey: string;
  sourcePub: string;
  sellAsset: string;
  buyAsset: string;
  amount: string;
  signXdr: (xdr: string, description: string) => Promise<string>;
  onProgress?: (event: Record<string, unknown>) => void;
  networkPassphrase?: string;
  /** Test injection: replaces `new Mediator(...args)`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _mediatorFactory?: (...args: any[]) => any;
  /** Test injection: replaces `new StellarBrokerClient(opts)`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _clientFactory?: (opts: any) => any;
}

export interface SwapResult {
  ok: boolean;
  blocked?: boolean;
  finished?: Record<string, unknown>;
  error?: string;
}

export function executeSbMediatorSwap(opts: ExecuteSbMediatorSwapOptions): Promise<SwapResult>;

export function hasObsoleteMediators(sourcePub: string): boolean;

export interface DisposeObsoleteMediatorsOptions {
  sourcePub: string;
  signXdr: (xdr: string, description: string) => Promise<string>;
  networkPassphrase?: string;
  onProgress?: (event: Record<string, unknown>) => void;
}

export function disposeObsoleteMediators(opts: DisposeObsoleteMediatorsOptions): Promise<void>;
