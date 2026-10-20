import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { runPost } from '../tools/lib/image.ts';
import { compareDarkInk } from '../tools/review/pose-color.js';

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

describe('alpha island removal', () => {
  it('removes a 3-pixel speck and leaves the main blob unchanged', async () => {
    const width = 12;
    const height = 8;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const i = (y * width + x) * 4;
        pixels[i] = 20;
        pixels[i + 1] = 40;
        pixels[i + 2] = 60;
        pixels[i + 3] = 255;
      }
    }
    for (const [x, y] of [[7, 1], [8, 2], [9, 3]]) {
      const i = (y * width + x) * 4;
      pixels[i] = 80;
      pixels[i + 1] = 100;
      pixels[i + 2] = 120;
      pixels[i + 3] = 255;
    }

    const input = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
    const output = await runPost(input, [{ dropIslands: { minArea: 4 } }]);
    const { data } = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        const i = (y * width + x) * 4;
        expect([...data.subarray(i, i + 4)]).toEqual([20, 40, 60, 255]);
      }
    }
    for (const [x, y] of [[7, 1], [8, 2], [9, 3]]) {
      expect(data[(y * width + x) * 4 + 3]).toBe(0);
    }
  });
});

describe('Ming pose overlays', () => {
  const scene = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/scenes/ming_scriptorium.yaml', import.meta.url)), 'utf8')) as {
    pose_min_changed_pixels: number;
    poses: { linu: { foreground_silhouette_art: [number, number][] } };
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

  it('covers Linu’s full foreground silhouette in frame 1', async () => {
    const path = fileURLToPath(new URL('../public/art/ming/pose_linu.png', import.meta.url));
    const sidecar = JSON.parse(readFileSync(fileURLToPath(new URL('../assets/scenes/ming_scriptorium.art.json', import.meta.url)), 'utf8')) as {
      poses: { linu: { origin: [number, number] } };
    };
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frameWidth = info.width / 2;
    const [originX, originY] = sidecar.poses.linu.origin;
    const points = scene.poses.linu.foreground_silhouette_art;
    const minX = Math.max(originX, Math.floor(Math.min(...points.map(([x]) => x))));
    const maxX = Math.min(originX + frameWidth, Math.ceil(Math.max(...points.map(([x]) => x))));
    const minY = Math.max(originY, Math.floor(Math.min(...points.map(([, y]) => y))));
    const maxY = Math.min(originY + info.height, Math.ceil(Math.max(...points.map(([, y]) => y))));
    const inside = (x: number, y: number) => {
      let result = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i], [bx, by] = points[j];
        if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) result = !result;
      }
      return result;
    };
    let minAlpha = 255;
    let samples = 0;
    for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const alpha = data[((y - originY) * info.width + frameWidth + x - originX) * info.channels + 3];
      minAlpha = Math.min(minAlpha, alpha);
      samples++;
    }
    expect(samples).toBeGreaterThan(0);
    expect(minAlpha).toBeGreaterThanOrEqual(128);
  });

  it('keeps dark ink neutral while applying mean-only color offsets', () => {
    const script = `
import importlib.util, json
from PIL import Image
spec = importlib.util.spec_from_file_location("scene_cut", "tools/art/scene-cut.py")
scene_cut = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scene_cut)
edit = Image.new("RGB", (4, 1))
edit.putdata([(40, 30, 25), (100, 120, 140), (120, 100, 80), (250, 240, 230)])
plate = Image.new("RGB", (4, 1))
plate.putdata([(40, 30, 25), (110, 130, 150), (130, 110, 90), (250, 240, 230)])
changed = Image.new("L", (4, 1), 0)
changed.putpixel((0, 0), 255)
changed.putpixel((3, 0), 255)
output = scene_cut.match_color(edit, edit, plate, changed, None)
print(json.dumps([list(pixel) for pixel in output.getdata()]))
`;
    const output = execFileSync('python3', ['-c', script], { cwd: process.cwd(), encoding: 'utf8' });
    const pixels = JSON.parse(output.trim().split('\n').at(-1)!) as number[][];
    expect(pixels).toEqual([
      [40, 30, 25],
      [110, 130, 150],
      [130, 110, 90],
      [255, 250, 240],
    ]);
  });

  it('checks dark-line hue and chroma against a synthetic plate', () => {
    const plate = new Uint8ClampedArray([35, 30, 25, 255, 45, 36, 30, 255]);
    const matching = compareDarkInk(plate, 2, 1, plate, 2, 1, 0, 0);
    expect(matching.ok).toBe(true);
    expect(matching.chromaDifference).toBe(0);

    const tinted = new Uint8ClampedArray([35, 30, 50, 255, 45, 36, 60, 255]);
    const mismatch = compareDarkInk(tinted, 2, 1, plate, 2, 1, 0, 0);
    expect(mismatch.chromaDifference).toBeGreaterThanOrEqual(8);
    expect(mismatch.ok).toBe(false);

    const hueShift = new Uint8ClampedArray([25, 30, 35, 255, 30, 36, 45, 255]);
    const hueMismatch = compareDarkInk(hueShift, 2, 1, plate, 2, 1, 0, 0);
    expect(hueMismatch.chromaDifference).toBeLessThan(8);
    expect(hueMismatch.hueDifference).toBeGreaterThanOrEqual(15);
    expect(hueMismatch.ok).toBe(false);
  });
});
