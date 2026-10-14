/**
 * Layout-First Map Generation Prototype (`npx tsx tools/maps/layout-blockout-demo.ts [outDir]`)
 *
 * Demonstrates the "Structure-First, Constrained-Art" pipeline:
 * 1. Author walkable/blocked/trigger/exit geometry in code first (World Space 1920x1080).
 * 2. Render clean & annotated SVG blockout images (Art Space 960x540).
 * 3. Pass the clean blockout + style reference (`bg_avenue.png`) to `gemini-3-pro-image`.
 * 4. Post-process (resize 960x540 + 128-colour quantize) and verify 1:1 collision overlay alignment.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateImage } from '../lib/gemini.ts';
import { runPost } from '../lib/image.ts';

const ROOT = join(import.meta.dirname, '../..');
const OUT = process.argv[2] ?? join(ROOT, 'docs/design-notes/images');
mkdirSync(OUT, { recursive: true });

// World space: 1920x1080 -> Art space: 960x540 (scale 0.5)
const W = 960;
const H = 540;
const s = 0.5;

const walkable = [
  { x: 0, y: 500, w: 1920, h: 320, label: 'MAIN PAVED PATH' },
  { x: 760, y: 350, w: 400, h: 150, label: 'COURTYARD PLAZA' },
  { x: 860, y: 260, w: 200, h: 90, label: 'ARCHIVIST STEPS' },
];

const buildings = [
  { x: 520, y: 20, w: 880, h: 250, color: '#b85d4b', roof: '#5a6978', label: 'OLD BRICK BUILDING: 校史馆' },
  { x: 1460, y: 120, w: 340, h: 260, color: '#7a8b99', roof: '#4b5a68', label: 'BOILER ROOM: 旧锅炉房' },
];

const blockedProps = [
  { x: 580, y: 380, w: 150, h: 70, color: '#c9a66b', label: 'STONE STELA (立碑)' },
  { x: 1200, y: 370, w: 200, h: 90, color: '#4d9be6', label: 'KOI POND (荷花池)' },
  { x: 1480, y: 390, w: 260, h: 60, color: '#d97724', label: 'VENDING MACHINES (自动售货机)' },
  { x: 60, y: 420, w: 90, h: 70, color: '#8f563b', label: 'SIGNPOST: ← 图书馆' },
  { x: 640, y: 830, w: 220, h: 60, color: '#a66f46', label: 'WOODEN BENCH (长椅)' },
];

const triggers = [
  { x: 860, y: 250, w: 200, h: 40, face: 'up', name: 'archive_door' },
  { x: 580, y: 440, w: 150, h: 40, face: 'up', name: 'stone_stela' },
  { x: 1480, y: 440, w: 260, h: 40, face: 'up', name: 'vending_machine' },
  { x: 1200, y: 450, w: 200, h: 40, face: 'up', name: 'koi_pond' },
  { x: 640, y: 800, w: 220, h: 35, face: 'down', name: 'courtyard_bench' },
];

const exits = [
  { x: 0, y: 500, w: 30, h: 320, label: 'EXIT LEFT -> LIBRARY' },
  { x: 1890, y: 500, w: 30, h: 320, label: 'EXIT RIGHT -> BACK HILL' },
];

const foregroundTrees = [
  { cx: 260, cy: 880, rx: 95, ry: 75, baseline: 1030 },
  { cx: 1180, cy: 890, rx: 90, ry: 72, baseline: 1040 },
  { cx: 1680, cy: 880, rx: 95, ry: 75, baseline: 1030 },
];

const blockoutCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="#5c8a47"/>
  <rect x="0" y="0" width="250" height="240" fill="#3d6630"/>
  <rect x="700" y="0" width="260" height="220" fill="#3d6630"/>
  <rect x="0" y="410" width="${W}" height="20" fill="#446e35"/>
  ${walkable.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#d6cfc2" stroke="#b5ada0" stroke-width="2"/>`).join('\n')}
  <rect x="0" y="250" width="${W}" height="22" fill="#e3dcd0" stroke="#c2b9ab" stroke-width="1"/>
  <rect x="0" y="388" width="${W}" height="22" fill="#e3dcd0" stroke="#c2b9ab" stroke-width="1"/>
  ${buildings.map((b) => `
    <rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" fill="${b.color}" stroke="#2b1d19" stroke-width="3"/>
    <rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s * 0.35}" fill="${b.roof}" stroke="#2b1d19" stroke-width="2"/>
  `).join('\n')}
  <rect x="${860 * s}" y="${180 * s}" width="${200 * s}" height="${70 * s}" fill="#3b2618" stroke="#e6c77a" stroke-width="2"/>
  ${blockedProps.map((p) => `<rect x="${p.x * s}" y="${p.y * s}" width="${p.w * s}" height="${p.h * s}" rx="4" fill="${p.color}" stroke="#261b12" stroke-width="2"/>`).join('\n')}
  ${foregroundTrees.map((t) => `
    <rect x="${(t.cx - 18) * s}" y="${t.cy * s}" width="${36 * s}" height="${(t.baseline - t.cy) * s}" fill="#6e472b"/>
    <ellipse cx="${t.cx * s}" cy="${t.cy * s}" rx="${t.rx * s}" ry="${t.ry * s}" fill="#487a38" stroke="#2d5222" stroke-width="2"/>
  `).join('\n')}
</svg>`;

const blockoutAnnotatedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12" font-weight="bold">
  ${blockoutCleanSvg.replace(/<\/?svg[^>]*>/g, '')}
  ${exits.map((e) => `<rect x="${e.x * s}" y="${e.y * s}" width="${Math.max(8, e.w * s)}" height="${e.h * s}" fill="#ffff00" fill-opacity="0.6" stroke="#ff9900" stroke-width="2"/>`).join('\n')}
  ${triggers.map((t) => `<rect x="${t.x * s}" y="${t.y * s}" width="${t.w * s}" height="${t.h * s}" fill="#00ccff" fill-opacity="0.45" stroke="#0066ff" stroke-width="2"/>`).join('\n')}
  <text x="480" y="330" fill="#332b22" text-anchor="middle" font-size="16">WALKABLE PAVED ROAD (100% CLEAR, NO OBSTACLES)</text>
  <text x="480" y="210" fill="#332b22" text-anchor="middle" font-size="13">COURTYARD PLAZA</text>
  <text x="480" y="90" fill="#ffffff" text-anchor="middle" font-size="16">校史馆 (UNIVERSITY ARCHIVES)</text>
  <text x="815" y="130" fill="#ffffff" text-anchor="middle" font-size="13">旧锅炉房 (BOILER ROOM)</text>
  <text x="325" y="212" fill="#221a12" text-anchor="middle" font-size="11">石碑</text>
  <text x="650" y="210" fill="#ffffff" text-anchor="middle" font-size="11">荷花池</text>
  <text x="805" y="212" fill="#ffffff" text-anchor="middle" font-size="11">售货机</text>
  <text x="375" y="435" fill="#ffffff" text-anchor="middle" font-size="11">长椅 (Bench)</text>
  <text x="52" y="228" fill="#ffffff" text-anchor="middle" font-size="10">← 图书馆</text>
</svg>`;

async function main() {
  const cleanBlockoutPath = join(OUT, '1_blockout_clean_ref.png');
  const annotatedBlockoutPath = join(OUT, '1_blockout_annotated.png');
  await sharp(Buffer.from(blockoutCleanSvg)).png().toFile(cleanBlockoutPath);
  await sharp(Buffer.from(blockoutAnnotatedSvg)).png().toFile(annotatedBlockoutPath);

  const finalBgPath = join(OUT, '2_generated_retro_bg.png');
  if (!existsSync(finalBgPath) || process.argv.includes('--force')) {
    const bible = readFileSync(join(ROOT, 'assets/style/bible-campus.md'), 'utf8');
    const styleRef = readFileSync(join(ROOT, 'public/art/retro/bg_avenue.png'));
    const layoutRef = readFileSync(cleanBlockoutPath);

    const prompt = `${bible.trim()}

---
ASSET: retro/bg_archive_courtyard
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle, pixel art scale, palette, dithering, and late-afternoon lighting (straight-on high-angle 3/4 view, building fronts face the viewer, horizontal ground lines).
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Across the middle (where the wide light-grey horizontal band is in the blockout): a completely open, unobstructed paved stone road running from the LEFT edge to the RIGHT edge, with tiled sidewalks along its top and bottom edges. Nothing stands on the road or blocks either end.
2. Top centre (over the large brick-red block): a vintage 1950s red-brick and grey-stone two-storey Chinese university building facing the viewer, with double wooden entrance doors and stone steps in the centre, and a traditional horizontal plaque above the entrance reading "校史馆" in clear Chinese characters.
3. Top right (over the grey-blue block): an old brick annex / campus boiler room with a rusted iron door and vents.
4. On the upper courtyard flanking the entrance (matching the 3 coloured blocks):
   - Left of the steps (tan block): an old carved stone stela (石碑) on a stone tortoise base.
   - Right of the steps (blue block): a small rectangular stone-rimmed lotus pond (荷花池) with lily pads.
   - Far right in front of the annex (orange block): two retro blue-and-white beverage vending machines standing side by side, facing down toward the road.
   - Far left on the upper sidewalk edge (small brown block): a small wooden signpost with an arrow pointing left and the characters "图书馆".
5. Along the bottom lawn strip (green zone below the lower sidewalk): a low trimmed hedge, a wooden park bench in the middle (brown block), and three plane trees positioned ONLY at the three green circles on the lower lawn, never overlapping the road.`;

    const rawPng = await generateImage({
      model: 'gemini-3-pro-image',
      prompt,
      refs: [
        { mimeType: 'image/png', data: styleRef },
        { mimeType: 'image/png', data: layoutRef },
      ],
      aspectRatio: '16:9',
      imageSize: '2K',
    });

    const postPng = await runPost(rawPng, [
      { resize: { width: 960, height: 540 } },
      { quantize: { colors: 128 } },
    ]);
    writeFileSync(finalBgPath, postPng);
  }

  const overlaySvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${walkable.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#00ff00" fill-opacity="0.22" stroke="#00ff00" stroke-width="1.5"/>`).join('\n')}
    ${[...buildings, ...blockedProps].map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#ff0000" fill-opacity="0.32" stroke="#ff0000" stroke-width="1.5"/>`).join('\n')}
    ${triggers.map((t) => `<rect x="${t.x * s}" y="${t.y * s}" width="${t.w * s}" height="${t.h * s}" fill="#3399ff" fill-opacity="0.45" stroke="#3399ff" stroke-width="1.5"/>`).join('\n')}
    ${exits.map((e) => `<rect x="${e.x * s}" y="${e.y * s}" width="${Math.max(4, e.w * s)}" height="${e.h * s}" fill="#ffff00" fill-opacity="0.55" stroke="#ffcc00"/>`).join('\n')}
    ${foregroundTrees.map((t) => `<ellipse cx="${t.cx * s}" cy="${t.cy * s}" rx="${t.rx * s}" ry="${t.ry * s}" fill="none" stroke="#ff00ff" stroke-width="1.5" stroke-dasharray="4"/>`).join('\n')}
  </svg>`;

  const verifyOverlayPath = join(OUT, '3_alignment_overlay.png');
  await sharp(readFileSync(finalBgPath)).composite([{ input: Buffer.from(overlaySvg) }]).png().toFile(verifyOverlayPath);
  console.log('Done:', OUT);
}

main();
