import { describe, expect, it } from 'vitest';
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
