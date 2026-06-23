import { describe, it, expect } from 'vitest';
import { loadCollectorConfig } from './config.js';
import { toStroops } from '../core/amount.js';

const base = {
  STELLAR_RPC_URL: 'rpc', STELLAR_HORIZON_URL: 'horizon',
};

describe('loadCollectorConfig', () => {
  it('applique les défauts quand l env est vide', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.cadenceSec).toBe(900);
    expect(c.sizesBlnd).toEqual([toStroops('250'), toStroops('750')]);
    expect(c.pairs).toEqual(['USDC', 'EURC']);
    expect(c.rawRetentionDays).toBe(90);
    expect(c.rollupAfterDays).toBe(365);
  });
  it('parse les tailles et paires depuis l env', () => {
    const c = loadCollectorConfig({ ...base, COLLECTOR_SIZES_BLND: '100, 500 ,1000', COLLECTOR_PAIRS: 'USDC' });
    expect(c.sizesBlnd).toEqual([toStroops('100'), toStroops('500'), toStroops('1000')]);
    expect(c.pairs).toEqual(['USDC']);
  });
  it('rejette une cadence invalide', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: 'x' })).toThrow();
  });
  it('rejette une paire inconnue', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_PAIRS: 'BTC' })).toThrow();
  });
  it('rpcUrls = [primary] quand pas de fallback', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.rpcUrls).toEqual(['rpc']);
  });
  it('rpcUrls = [primary, fallback] quand fallback différent', () => {
    const c = loadCollectorConfig({ ...base, STELLAR_RPC_URL_FALLBACK: 'rpc2' });
    expect(c.rpcUrls).toEqual(['rpc', 'rpc2']);
  });
  it('déduplique si fallback = primary', () => {
    const c = loadCollectorConfig({ ...base, STELLAR_RPC_URL_FALLBACK: 'rpc' });
    expect(c.rpcUrls).toEqual(['rpc']);
  });
  it('rejette jitterSec >= cadenceSec (tight-loop guard)', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: '60', COLLECTOR_JITTER_SEC: '60' })).toThrow();
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: '60', COLLECTOR_JITTER_SEC: '90' })).toThrow();
  });
  it('lit WALLET_ADDRESS depuis l env', () => {
    const c = loadCollectorConfig({ ...base, WALLET_ADDRESS: 'GTEST' });
    expect(c.walletAddress).toBe('GTEST');
  });
  it('walletAddress = undefined si absent', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.walletAddress).toBeUndefined();
  });
});
