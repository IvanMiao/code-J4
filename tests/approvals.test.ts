import { describe, expect, it } from 'vitest';
import { loadApprovals, requiredAssets, seedApprovals } from '../tools/lib/approvals.ts';

describe('asset approval inputs', () => {
  const assets = requiredAssets();
  const keys = new Set(assets.map((asset) => asset.key));

  it('requires map, placed-sprite, and bubble-hand keys with short SHA-256 hashes', () => {
    expect(keys).toContain('bg:ming_canal_street');
    expect(keys).toContain('sprite:linxia');
    expect(keys).toContain('sprite:shen');
    expect(keys).toContain('hand:song');
    expect(assets.every((asset) => /^[a-f0-9]{16}$/.test(asset.hash))).toBe(true);
  });

  it('seeds assets as legacy only when their files match origin/main', () => {
    const seed = seedApprovals();
    expect(seed['bg:ming_canal_street']).toMatchObject({ status: 'pending', legacy: false });
    expect(seed['sprite:shen']).toMatchObject({ status: 'pending', legacy: false });
    expect(seed['sprite:linxia']).toMatchObject({ status: 'approved', legacy: true, note: 'in main before the review flow' });
    expect(seed['sprite:nika']).toMatchObject({ status: 'approved', legacy: true });
  });

  it('preserves existing non-legacy decisions when reseeding', () => {
    const existing = loadApprovals();
    const decision = {
      ...existing['bg:ming_canal_street'],
      status: 'rejected' as const,
      note: 'owner review',
    };
    const seed = seedApprovals('.', { ...existing, 'bg:ming_canal_street': decision });
    expect(seed['bg:ming_canal_street']).toEqual(decision);
  });
});
