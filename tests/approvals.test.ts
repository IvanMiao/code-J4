import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadApprovals, requiredAssets, reviewAssets, seedApprovals } from '../tools/lib/approvals.ts';

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

  it('requires approval for every referenced image layer', () => {
    const root = mkdtempSync(join(tmpdir(), 'code-j4-layer-approval-'));
    try {
      mkdirSync(join(root, 'content/maps'), { recursive: true });
      mkdirSync(join(root, 'content/cast'), { recursive: true });
      mkdirSync(join(root, 'public/art/retro'), { recursive: true });
      writeFileSync(join(root, 'content/cast/cast.yaml'), 'linxia:\n  sprite: fixture_sprite\n');
      writeFileSync(join(root, 'content/maps/fixture.tmj'), JSON.stringify({
        width: 1, height: 1, tilewidth: 10, tileheight: 10,
        properties: [{ name: 'background', value: 'fixture_bg' }],
        layers: [{ id: 7, type: 'imagelayer', name: 'far', image: 'layer_unapproved' }],
      }));
      writeFileSync(join(root, 'public/art/retro/fixture_bg.png'), 'background');
      writeFileSync(join(root, 'public/art/retro/fixture_sprite.png'), 'sprite');
      writeFileSync(join(root, 'public/art/retro/layer_unapproved.png'), 'layer');

      const layer = reviewAssets(root).find((asset) => asset.key === 'layer:fixture:7');
      expect(layer).toMatchObject({ kind: 'layer', path: 'public/art/retro/layer_unapproved.png', stale: false });
      expect(layer?.decision).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('builds approval inputs for the canal map without scene files', () => {
    const root = mkdtempSync(join(tmpdir(), 'code-j4-canal-approval-'));
    try {
      mkdirSync(join(root, 'content/maps'), { recursive: true });
      mkdirSync(join(root, 'content/cast'), { recursive: true });
      mkdirSync(join(root, 'public/art/ming'), { recursive: true });
      writeFileSync(join(root, 'content/cast/cast.yaml'), 'shen:\n  art: ming\n  sprite: shen_sprite\n  sheet: side\n');
      writeFileSync(join(root, 'content/maps/ming_canal_street.tmj'), JSON.stringify({
        width: 4492, height: 540, tilewidth: 1, tileheight: 1,
        properties: [
          { name: 'background', value: 'bg_canal_long' },
          { name: 'art', value: 'ming' },
          { name: 'view', value: 'side' },
          { name: 'player', value: 'shen' },
        ],
        layers: [],
      }));
      writeFileSync(join(root, 'public/art/ming/bg_canal_long.png'), 'background');
      writeFileSync(join(root, 'public/art/ming/shen_sprite.png'), 'sprite');

      expect(requiredAssets(root).map((asset) => asset.key)).toContain('bg:ming_canal_street');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
