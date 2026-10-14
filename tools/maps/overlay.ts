/** Draws each map's collision and trigger layers over its retro background at 1x: `npm run maps:overlay [outDir]`. */
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseMap } from '../../src/engine/map.ts';

const ROOT = join(import.meta.dirname, '../..');
const outDir = process.argv[2] ?? '/tmp/overlay';
mkdirSync(outDir, { recursive: true });

for (const f of readdirSync(join(ROOT, 'content/maps')).filter((f) => f.endsWith('.tmj'))) {
  const id = f.replace('.tmj', '');
  const m = parseMap(JSON.parse(readFileSync(join(ROOT, 'content/maps', f), 'utf8')));
  const bg = join(ROOT, 'public/art/retro', `${m.background}.png`);
  const meta = await sharp(bg).metadata();
  const k = meta.width! / m.width;
  const pts = (p: { x: number; y: number }[]) => p.map((v) => `${v.x * k},${v.y * k}`).join(' ');
  const rect = (r: { x: number; y: number; width: number; height: number }, style: string) =>
    `<rect x="${r.x * k}" y="${r.y * k}" width="${Math.max(2, r.width * k)}" height="${Math.max(2, r.height * k)}" ${style}/>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">`,
    ...m.walkable.map((p) => `<polygon points="${pts(p)}" fill="#00ff00" fill-opacity="0.25" stroke="#00ff00"/>`),
    ...m.blocked.map((p) => `<polygon points="${pts(p)}" fill="#ff0000" fill-opacity="0.35" stroke="#ff0000"/>`),
    ...m.foreground.map((f) => `<polygon points="${pts(f.polygon)}" fill="none" stroke="#ff00ff" stroke-dasharray="3"/>`),
    ...m.triggers.map((t) => rect(t, 'fill="#3399ff" fill-opacity="0.4" stroke="#3399ff"')),
    ...m.exits.map((e) => rect(e, 'fill="#ffff00" fill-opacity="0.5"')),
    ...(m.ambient ?? []).map((a) => rect(a, 'fill="none" stroke="#00ffff" stroke-dasharray="2"')),
    '</svg>',
  ].join('');
  const out = join(outDir, `${id}.png`);
  await sharp(bg).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
  console.log(out);
}
