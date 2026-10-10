import sharp from 'sharp';

export type PostStep =
  /** Keep a horizontal band, as fractions of the height (drops layouts copied from a reference sheet). */
  | { crop: { y: number; h: number } }
  | { resize: { width: number; height: number; fit?: 'cover' | 'contain' | 'fill'; kernel?: 'nearest' | 'lanczos3' } }
  | { chromaKey: { hueMin?: number; hueMax?: number; satMin?: number; valMin?: number } }
  | { trim: true }
  | { quantize: { colors: number; dither?: number } }
  | { pixelate: { factor: number } }
  | { sheet: { cols: number; rows: number; frameWidth: number; frameHeight: number; padding?: number; fitHeight?: number } };

interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

async function toRaw(img: Buffer): Promise<Raw> {
  const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function fromRaw(r: Raw): ReturnType<typeof sharp> {
  return sharp(r.data, { raw: { width: r.width, height: r.height, channels: 4 } });
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max / 255];
}

/** Keys out a green screen and removes green spill on the remaining edge pixels. */
export function chromaKey(r: Raw, o: { hueMin?: number; hueMax?: number; satMin?: number; valMin?: number }): Raw {
  const hueMin = o.hueMin ?? 85;
  const hueMax = o.hueMax ?? 155;
  const satMin = o.satMin ?? 0.35;
  const valMin = o.valMin ?? 0.25;
  const out = Buffer.from(r.data);
  for (let i = 0; i < out.length; i += 4) {
    const [h, s, v] = rgbToHsv(out[i], out[i + 1], out[i + 2]);
    if (h >= hueMin && h <= hueMax && s >= satMin && v >= valMin) {
      out[i + 3] = 0;
    } else if (out[i + 1] > Math.max(out[i], out[i + 2])) {
      out[i + 1] = Math.max(out[i], out[i + 2]);
    }
  }
  return { ...r, data: out };
}

function alphaBox(r: Raw, x0: number, y0: number, w: number, h: number) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (r.data[(y * r.width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Splits an AI sprite sheet into an equal grid, trims each cell to its content and
 * re-packs every frame bottom-centred at one shared scale, so feet line up across frames.
 */
async function packSheet(r: Raw, o: { cols: number; rows: number; frameWidth: number; frameHeight: number; padding?: number; fitHeight?: number }): Promise<Raw> {
  const cw = Math.floor(r.width / o.cols);
  const ch = Math.floor(r.height / o.rows);
  const boxes = [];
  for (let row = 0; row < o.rows; row++)
    for (let col = 0; col < o.cols; col++) boxes.push(alphaBox(r, col * cw, row * ch, cw, ch));
  const pad = o.padding ?? 2;
  const maxH = Math.max(...boxes.map((b) => b?.h ?? 0));
  const maxW = Math.max(...boxes.map((b) => b?.w ?? 0));
  const widthCap = (o.frameWidth - pad * 2) / maxW;
  const scale = Math.min((o.fitHeight ?? o.frameHeight - pad) / maxH, widthCap);
  if (o.fitHeight && widthCap < o.fitHeight / maxH) console.warn(`[sheet] width-limited: content ${Math.round(maxH * scale)}px tall, wanted ${o.fitHeight}`);
  const src = fromRaw(r);
  const srcPng = await src.png().toBuffer();
  const composites: Exclude<Parameters<ReturnType<typeof sharp>["composite"]>[0], undefined> = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (!b) continue;
    const w = Math.max(1, Math.round(b.w * scale));
    const h = Math.max(1, Math.round(b.h * scale));
    const frame = await sharp(srcPng).extract({ left: b.x, top: b.y, width: b.w, height: b.h }).resize(w, h).png().toBuffer();
    const col = i % o.cols;
    const row = Math.floor(i / o.cols);
    composites.push({
      input: frame,
      left: col * o.frameWidth + Math.round((o.frameWidth - w) / 2),
      top: row * o.frameHeight + (o.frameHeight - pad - h),
    });
  }
  const sheet = sharp({
    create: { width: o.cols * o.frameWidth, height: o.rows * o.frameHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite(composites);
  return toRaw(await sheet.png().toBuffer());
}

export async function runPost(input: Buffer, steps: PostStep[]): Promise<Buffer> {
  let r = await toRaw(input);
  for (const step of steps) {
    if ('crop' in step) {
      const png = await fromRaw(r).png().toBuffer();
      const md = await sharp(png).metadata();
      const top = Math.round(md.height! * step.crop.y), height = Math.round(md.height! * step.crop.h);
      r = await toRaw(await sharp(png).extract({ left: 0, top, width: md.width!, height }).png().toBuffer());
    } else if ('resize' in step) {
      const s = step.resize;
      r = await toRaw(await fromRaw(r).resize(s.width, s.height, { fit: s.fit ?? 'cover', kernel: s.kernel ?? 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer());
    } else if ('chromaKey' in step) {
      r = chromaKey(r, step.chromaKey);
    } else if ('trim' in step) {
      const b = alphaBox(r, 0, 0, r.width, r.height);
      if (b) r = await toRaw(await fromRaw(r).extract({ left: b.x, top: b.y, width: b.w, height: b.h }).png().toBuffer());
    } else if ('quantize' in step) {
      r = await toRaw(await fromRaw(r).png({ palette: true, colours: step.quantize.colors, dither: step.quantize.dither ?? 0.6 }).toBuffer());
    } else if ('pixelate' in step) {
      const f = step.pixelate.factor;
      const small = await fromRaw(r).resize(Math.round(r.width / f), Math.round(r.height / f), { kernel: 'lanczos3' }).png().toBuffer();
      r = await toRaw(await sharp(small).resize(r.width, r.height, { kernel: 'nearest' }).png().toBuffer());
    } else if ('sheet' in step) {
      r = await packSheet(r, step.sheet);
    }
  }
  return fromRaw(r).png({ compressionLevel: 9 }).toBuffer();
}

/** Stacks images vertically (left-aligned); `mirror` flips that row horizontally, frame order included. */
export async function stackRows(rows: { png: Buffer; mirror: boolean }[]): Promise<Buffer> {
  const parts = await Promise.all(
    rows.map(async (r) => {
      const { data, info } = await (r.mirror ? sharp(r.png).flop() : sharp(r.png)).png().toBuffer({ resolveWithObject: true });
      return { data, w: info.width, h: info.height };
    }),
  );
  let top = 0;
  const layers = parts.map((p) => {
    const l = { input: p.data, left: 0, top };
    top += p.h;
    return l;
  });
  const width = Math.max(...parts.map((p) => p.w));
  return sharp({ create: { width, height: top, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer();
}
