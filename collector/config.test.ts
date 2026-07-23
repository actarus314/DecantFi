import { describe, it, expect } from 'vitest';
import { loadCollectorConfig } from './config.js';
import { toStroops } from '../core/amount.js';

const base = {
  STELLAR_RPC_URL: 'rpc', STELLAR_HORIZON_URL: 'horizon',
};

describe('loadCollectorConfig', () => {
  it('applies defaults when env is empty', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.cadenceSec).toBe(900);
    expect(c.sizesBlnd).toEqual([toStroops('250'), toStroops('750')]);
    expect(c.pairs).toEqual(['USDC', 'EURC']);
    expect(c.rawRetentionDays).toBe(90);
    expect(c.rollupAfterDays).toBe(365);
  });
  it('parses sizes and pairs from env', () => {
    const c = loadCollectorConfig({ ...base, COLLECTOR_SIZES_BLND: '100, 500 ,1000', COLLECTOR_PAIRS: 'USDC' });
    expect(c.sizesBlnd).toEqual([toStroops('100'), toStroops('500'), toStroops('1000')]);
    expect(c.pairs).toEqual(['USDC']);
  });
  it('rejects an invalid cadence', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: 'x' })).toThrow();
  });
  it('rejects an unknown pair', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_PAIRS: 'BTC' })).toThrow();
  });
  it('rpcUrls = [primary] when there is no fallback', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.rpcUrls).toEqual(['rpc']);
  });
  it('rpcUrls = [primary, fallback] when fallback differs', () => {
    const c = loadCollectorConfig({ ...base, STELLAR_RPC_URL_FALLBACK: 'rpc2' });
    expect(c.rpcUrls).toEqual(['rpc', 'rpc2']);
  });
  it('deduplicates when fallback = primary', () => {
    const c = loadCollectorConfig({ ...base, STELLAR_RPC_URL_FALLBACK: 'rpc' });
    expect(c.rpcUrls).toEqual(['rpc']);
  });
  it('rejects jitterSec >= cadenceSec (tight-loop guard)', () => {
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: '60', COLLECTOR_JITTER_SEC: '60' })).toThrow();
    expect(() => loadCollectorConfig({ ...base, COLLECTOR_CADENCE_SEC: '60', COLLECTOR_JITTER_SEC: '90' })).toThrow();
  });
  it('reads WALLET_ADDRESS from env', () => {
    const c = loadCollectorConfig({ ...base, WALLET_ADDRESS: 'GTEST' });
    expect(c.walletAddress).toBe('GTEST');
  });
  it('walletAddress = undefined when absent', () => {
    const c = loadCollectorConfig({ ...base });
    expect(c.walletAddress).toBeUndefined();
  });
});
