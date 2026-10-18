import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { runPost } from '../tools/lib/image.ts';

describe('ground-line removal', () => {
  it('removes a wide baseline row without keying out feet', async () => {
    const width = 100;
    const height = 100;
    const pixels = Buffer.alloc(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 0;
      pixels[i + 1] = 255;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }
    for (const x of [...Array.from({ length: 21 }, (_, i) => 20 + i), ...Array.from({ length: 21 }, (_, i) => 60 + i)]) {
      const i = (88 * width + x) * 4;
      pixels[i] = 20;
      pixels[i + 1] = 20;
      pixels[i + 2] = 20;
    }
    for (let x = 0; x < width; x++) {
      const i = (95 * width + x) * 4;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
    }

    const input = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await runPost(input, [{ removeGroundLine: true }, { chromaKey: {} }]);
    const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });

    expect(data[(95 * width + 50) * 4 + 3]).toBe(0);
    expect(data[(88 * width + 30) * 4 + 3]).toBe(255);
  });
});

describe('Ming pose overlays', () => {
  const scene = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/scenes/ming_scriptorium.yaml', import.meta.url)), 'utf8')) as {
    pose_min_changed_pixels: number;
  };

  for (const id of ['linu', 'monk_left', 'monk_right']) {
    it(`${id} has an empty frame 0 and enough changed pixels in frame 1`, async () => {
      const path = fileURLToPath(new URL(`../public/art/ming/pose_${id}.png`, import.meta.url));
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const frameWidth = info.width / 2;
      expect(Number.isInteger(frameWidth)).toBe(true);
      let frame0Opaque = 0;
      let frame1Opaque = 0;
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < frameWidth; x++) {
          const frame0Alpha = data[(y * info.width + x) * info.channels + 3];
          const frame1Alpha = data[(y * info.width + frameWidth + x) * info.channels + 3];
          if (frame0Alpha > 0) frame0Opaque++;
          if (frame1Alpha >= 128) frame1Opaque++;
        }
      }
      expect(frame0Opaque).toBe(0);
      expect(frame1Opaque).toBeGreaterThanOrEqual(scene.pose_min_changed_pixels);
    });
  }
});
