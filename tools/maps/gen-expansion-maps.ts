/**
 * Generates Layout-First blockouts, Retro 98 pixel art backgrounds, and 1:1 collision overlays
 * for the City & Suburb expansion maps:
 *   1. City: 九号高架桥底 (Under Overpass No. 9 — e-bike repair shop, noodle stall, bus stop)
 *   2. Suburb: 第三印染厂与绿幕防波堤 (Suburban Dye Works & Chroma-Key Dyke)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateImage } from '../lib/gemini.ts';
import { runPost } from '../lib/image.ts';

// Load GOOGLE_API_KEY / GEMINI_API_KEY from ~/.hermes/.env if not in env
if (!process.env.GEMINI_API_KEY) {
  const envPath = join(process.env.HOME ?? '/home/ymiao', '.hermes/.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = /^(?:GEMINI_API_KEY|GOOGLE_API_KEY)=(.+)$/.exec(line.trim());
      if (m) {
        process.env.GEMINI_API_KEY = m[1].replace(/^['"]|['"]$/g, '');
        break;
      }
    }
  }
}

const ROOT = join(import.meta.dirname, '../..');
const OUT = join(ROOT, 'docs/design-notes/images');
mkdirSync(OUT, { recursive: true });

const W = 960;
const H = 540;
const s = 0.5; // World 1920x1080 -> Art 960x540

const bible = readFileSync(join(ROOT, 'assets/style/bible-campus.md'), 'utf8');
const styleRef = readFileSync(join(ROOT, 'public/art/retro/bg_avenue.png'));

// ============================================================================
// SCENE 1: CITY — 九号高架桥底 (Overpass No. 9)
// ============================================================================
const overpassWalkable = [
  { x: 0, y: 520, w: 1920, h: 320 },
  { x: 420, y: 400, w: 360, h: 120 },
  { x: 1120, y: 400, w: 380, h: 120 },
];

const overpassBlocked = [
  // Massive concrete overpass bridge deck across the very top & two support pillars
  { x: 0, y: 0, w: 1920, h: 150, color: '#5c646d', label: 'CONCRETE OVERPASS DECK (高架桥面)' },
  { x: 120, y: 150, w: 220, h: 320, color: '#737c85', label: 'PILLAR A (桥墩)' },
  { x: 1580, y: 150, w: 220, h: 320, color: '#737c85', label: 'PILLAR B (桥墩)' },
  // Under-bridge shops & stalls
  { x: 380, y: 160, w: 460, h: 250, color: '#3b6e8c', label: 'REPAIR SHOP: 电动车修理' },
  { x: 860, y: 200, w: 240, h: 260, color: '#8c523b', label: 'PAYPHONE & TRANSFORMER (公用电话/配电箱)' },
  { x: 1120, y: 170, w: 420, h: 240, color: '#c4513b', label: 'NIGHT STALL: 砂锅牛肉面' },
  // Props
  { x: 60, y: 440, w: 110, h: 70, color: '#2d7a4d', label: 'BUS STOP: 302路' },
  { x: 420, y: 860, w: 340, h: 90, color: '#475966', label: 'PARKED DELIVERY E-BIKES (外卖电动车排)' },
  { x: 1260, y: 860, w: 260, h: 90, color: '#b87d32', label: 'PLASTIC TABLES & STOOLS (塑料桌椅)' },
];

const overpassTriggers = [
  { x: 460, y: 400, w: 280, h: 45, face: 'up', name: 'repair_shop' },
  { x: 880, y: 450, w: 200, h: 45, face: 'up', name: 'payphone_box' },
  { x: 1180, y: 400, w: 300, h: 45, face: 'up', name: 'noodle_stall' },
  { x: 50, y: 500, w: 130, h: 45, face: 'up', name: 'bus_stop_302' },
  { x: 420, y: 820, w: 340, h: 40, face: 'down', name: 'ebike_row' },
];

const overpassExits = [
  { x: 0, y: 520, w: 30, h: 320 },
  { x: 1890, y: 520, w: 30, h: 320 },
];

const overpassCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Dark urban ground base -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="#3d434a"/>
  <!-- Lower sidewalk strip -->
  <rect x="0" y="420" width="${W}" height="120" fill="#525861"/>
  <!-- Walkable asphalt road & shop aprons -->
  ${overpassWalkable.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#7c8288" stroke="#9ea4aa" stroke-width="2"/>`).join('\n')}
  <!-- Sidewalk curbs -->
  <rect x="0" y="250" width="${W}" height="16" fill="#a8a299"/>
  <rect x="0" y="416" width="${W}" height="14" fill="#a8a299"/>
  <!-- Blocked structures -->
  ${overpassBlocked.map((b) => `<rect x="${b.x * s}" y="${b.y * s}" width="${b.w * s}" height="${b.h * s}" rx="2" fill="${b.color}" stroke="#1f2429" stroke-width="2"/>`).join('\n')}
  <!-- Warm shop interior openings -->
  <rect x="220" y="130" width="160" height="75" fill="#e6a845" stroke="#291d12" stroke-width="2"/>
  <rect x="580" y="135" width="170" height="70" fill="#eb8c34" stroke="#291d12" stroke-width="2"/>
</svg>`;

const overpassAnnotatedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12" font-weight="bold">
  ${overpassCleanSvg.replace(/<\/?svg[^>]*>/g, '')}
  ${overpassExits.map((e) => `<rect x="${e.x * s}" y="${e.y * s}" width="${Math.max(8, e.w * s)}" height="${e.h * s}" fill="#ffff00" fill-opacity="0.6" stroke="#ff9900" stroke-width="2"/>`).join('\n')}
  ${overpassTriggers.map((t) => `<rect x="${t.x * s}" y="${t.y * s}" width="${t.w * s}" height="${t.h * s}" fill="#00ccff" fill-opacity="0.45" stroke="#0066ff" stroke-width="2"/>`).join('\n')}
  <text x="480" y="45" fill="#ffffff" text-anchor="middle" font-size="15">九号高架桥面 (CONCRETE OVERPASS DECK)</text>
  <text x="115" y="155" fill="#ffffff" text-anchor="middle" font-size="12">桥墩 A</text>
  <text x="845" y="155" fill="#ffffff" text-anchor="middle" font-size="12">桥墩 B</text>
  <text x="305" y="115" fill="#ffffff" text-anchor="middle" font-size="14">电动车修理 (E-BIKE REPAIR)</text>
  <text x="490" y="160" fill="#ffffff" text-anchor="middle" font-size="11">配电箱/电话亭</text>
  <text x="665" y="115" fill="#ffffff" text-anchor="middle" font-size="14">砂锅牛肉面 (NOODLE STALL)</text>
  <text x="480" y="340" fill="#ffffff" text-anchor="middle" font-size="16">WALKABLE ASPHALT STREET (CLEAR LEFT TO RIGHT)</text>
  <text x="58" y="242" fill="#ffffff" text-anchor="middle" font-size="10">公交站</text>
  <text x="295" y="455" fill="#ffffff" text-anchor="middle" font-size="11">外卖电动车排</text>
  <text x="695" y="455" fill="#ffffff" text-anchor="middle" font-size="11">大排档塑料桌椅</text>
</svg>`;

// ============================================================================
// SCENE 2: SUBURB — 第三印染厂与绿幕防波堤 (Suburban Dye Works & Chroma-Key Dyke)
// ============================================================================
const suburbWalkable = [
  { x: 0, y: 520, w: 1640, h: 300 },
  { x: 460, y: 360, w: 320, h: 160 },
];

const suburbBlocked = [
  { x: 240, y: 40, w: 760, h: 320, color: '#8f4b3e', label: 'ABANDONED DYE FACTORY: 第三印染厂' },
  { x: 1060, y: 120, w: 500, h: 360, color: '#2b7a9e', label: 'IRIDESCENT DYE LAGOON (五彩排污水塘)' },
  { x: 80, y: 380, w: 180, h: 110, color: '#6b7075', label: 'RUSTED PIPE VALVE (生锈阀门)' },
  { x: 500, y: 840, w: 420, h: 120, color: '#d4cfc7', label: 'WIREFRAME UNFINISHED PAVILION (未渲染线稿凉亭)' },
  // The Chroma-Key Unrendered Void on the right edge!
  { x: 1640, y: 0, w: 280, h: 1080, color: '#00ff00', label: 'CHROMA-KEY VOID (#00FF00 绿幕断层)' },
];

const suburbTriggers = [
  { x: 480, y: 350, w: 280, h: 45, face: 'up', name: 'factory_gate' },
  { x: 1080, y: 470, w: 460, h: 45, face: 'up', name: 'dye_lagoon' },
  { x: 80, y: 480, w: 180, h: 45, face: 'up', name: 'pipe_valve' },
  { x: 1580, y: 540, w: 70, h: 260, face: 'right', name: 'chroma_edge' },
  { x: 520, y: 810, w: 380, h: 40, face: 'down', name: 'wireframe_pavilion' },
];

const suburbExits = [
  { x: 0, y: 520, w: 30, h: 300 },
];

const suburbCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Overgrown suburban marsh grass base -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="#596e42"/>
  <!-- Walkable dirt/gravel road -->
  ${suburbWalkable.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#b8aa93" stroke="#998b74" stroke-width="2"/>`).join('\n')}
  <!-- Abandoned Dye Factory -->
  <rect x="120" y="20" width="380" height="160" fill="#8f4b3e" stroke="#2b1915" stroke-width="3"/>
  <rect x="240" y="110" width="140" height="70" fill="#2e221f" stroke="#c9b49b" stroke-width="2"/>
  <!-- Multi-colored Iridescent Dye Pond -->
  <rect x="530" y="60" width="250" height="180" rx="14" fill="#2e85ab" stroke="#473b35" stroke-width="3"/>
  <ellipse cx="610" cy="140" rx="55" ry="35" fill="#d9468f"/>
  <ellipse cx="690" cy="170" rx="60" ry="38" fill="#e6b830"/>
  <ellipse cx="650" cy="110" rx="45" ry="25" fill="#42cf9b"/>
  <!-- Rusted Pipe Valve -->
  <rect x="40" y="190" width="90" height="55" fill="#6b7075" stroke="#292c2e" stroke-width="2"/>
  <!-- Wireframe Unfinished Structure on lower lawn -->
  <rect x="250" y="420" width="210" height="60" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="6"/>
  <!-- Right Edge: Unrendered Chroma-Key Green Void (#00FF00) with jagged pixel tear border -->
  <polygon points="820,0 960,0 960,540 820,540 805,460 830,380 800,300 825,210 805,110" fill="#00ff00" stroke="#ffffff" stroke-width="3"/>
</svg>`;

const suburbAnnotatedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="12" font-weight="bold">
  ${suburbCleanSvg.replace(/<\/?svg[^>]*>/g, '')}
  ${suburbExits.map((e) => `<rect x="${e.x * s}" y="${e.y * s}" width="${Math.max(8, e.w * s)}" height="${e.h * s}" fill="#ffff00" fill-opacity="0.6" stroke="#ff9900" stroke-width="2"/>`).join('\n')}
  ${suburbTriggers.map((t) => `<rect x="${t.x * s}" y="${t.y * s}" width="${t.w * s}" height="${t.h * s}" fill="#00ccff" fill-opacity="0.45" stroke="#0066ff" stroke-width="2"/>`).join('\n')}
  <text x="310" y="85" fill="#ffffff" text-anchor="middle" font-size="15">第三印染厂 (ABANDONED DYE WORKS)</text>
  <text x="655" y="150" fill="#ffffff" text-anchor="middle" font-size="13">五彩排污池 (QUANTIZED COLOR LAGOON)</text>
  <text x="85" y="220" fill="#ffffff" text-anchor="middle" font-size="10">生锈阀门</text>
  <text x="410" y="340" fill="#2e261d" text-anchor="middle" font-size="15">WALKABLE SUBURBAN GRAVEL ROAD</text>
  <text x="355" y="455" fill="#ffffff" text-anchor="middle" font-size="12">未渲染线稿建筑 (WIREFRAME RUIN)</text>
  <text x="885" y="270" fill="#000000" text-anchor="middle" font-size="13">绿幕断层 (#00FF00)</text>
</svg>`;

async function runScene(
  prefix: string,
  cleanSvg: string,
  annotatedSvg: string,
  promptBody: string,
  walkable: { x: number; y: number; w: number; h: number }[],
  blocked: { x: number; y: number; w: number; h: number }[],
  triggers: { x: number; y: number; w: number; h: number }[],
  exits: { x: number; y: number; w: number; h: number }[],
) {
  const cleanPath = join(OUT, `${prefix}_1_blockout_clean.png`);
  const annotatedPath = join(OUT, `${prefix}_1_blockout_annotated.png`);
  const bgPath = join(OUT, `${prefix}_2_retro_bg.png`);
  const overlayPath = join(OUT, `${prefix}_3_alignment_overlay.png`);

  await sharp(Buffer.from(cleanSvg)).png().toFile(cleanPath);
  await sharp(Buffer.from(annotatedSvg)).png().toFile(annotatedPath);

  console.log(`[${prefix}] Generating pixel art via gemini-3-pro-image...`);
  const rawPng = await generateImage({
    model: 'gemini-3-pro-image',
    prompt: `${bible.trim()}\n\n---\n${promptBody.trim()}`,
    refs: [
      { mimeType: 'image/png', data: styleRef },
      { mimeType: 'image/png', data: readFileSync(cleanPath) },
    ],
    aspectRatio: '16:9',
    imageSize: '2K',
  });

  const postPng = await runPost(rawPng, [
    { resize: { width: 960, height: 540 } },
    { quantize: { colors: 128 } },
  ]);
  writeFileSync(bgPath, postPng);

  const overlaySvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    ${walkable.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#00ff00" fill-opacity="0.22" stroke="#00ff00" stroke-width="1.5"/>`).join('\n')}
    ${blocked.map((r) => `<rect x="${r.x * s}" y="${r.y * s}" width="${r.w * s}" height="${r.h * s}" fill="#ff0000" fill-opacity="0.30" stroke="#ff0000" stroke-width="1.5"/>`).join('\n')}
    ${triggers.map((t) => `<rect x="${t.x * s}" y="${t.y * s}" width="${t.w * s}" height="${t.h * s}" fill="#3399ff" fill-opacity="0.45" stroke="#3399ff" stroke-width="1.5"/>`).join('\n')}
    ${exits.map((e) => `<rect x="${e.x * s}" y="${e.y * s}" width="${Math.max(4, e.w * s)}" height="${e.h * s}" fill="#ffff00" fill-opacity="0.55" stroke="#ffcc00"/>`).join('\n')}
  </svg>`;

  await sharp(postPng).composite([{ input: Buffer.from(overlaySvg) }]).png().toFile(overlayPath);
  console.log(`[${prefix}] Done -> ${bgPath}`);
}

async function main() {
  const overpassPrompt = `
ASSET: retro/bg_city_overpass
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, building fronts face the viewer, horizontal ground lines), pixel art scale, dithering, and late-dusk nostalgic urban atmosphere.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Across the very top (dark grey band) and flanking left/right sides: a massive weathered concrete urban overpass bridge (高架桥) running horizontally across the top, supported by two thick concrete pillars on the left and right.
2. Nestled directly underneath the overpass between the pillars, facing the viewer:
   - Left shop (blue block with warm yellow opening): a cluttered Chinese e-bike and scooter repair garage with spare tires, tools, warm tungsten light inside, and a weathered signboard above reading "电动车修理" in clear simplified Chinese characters.
   - Centre (brown block): a retro public payphone booth and a humming grey metal street transformer box plastered with tiny paper flyers.
   - Right shop (red block with warm orange opening): a steaming late-afternoon street-side claypot noodle stall with red lanterns, cooking pots, and a signboard reading "砂锅牛肉面" in clear simplified Chinese characters.
3. Far left on the upper sidewalk edge (small green block): a vintage Chinese bus stop sign pole reading "302路".
4. Across the middle (wide grey horizontal band): a completely open, unobstructed asphalt street running from the LEFT edge to the RIGHT edge. Nothing blocks the road or its left/right ends.
5. Along the bottom sidewalk strip below the road: a neat row of parked yellow-and-blue delivery electric scooters on the left (dark blue-grey block), and two low plastic street-food tables with small stools on the right (tan block).`;

  const suburbPrompt = `
ASSET: retro/bg_suburb_dyeworks
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, horizontal ground lines), pixel art scale, and soft ordered dithering.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Top left-centre (reddish-brown block): an old abandoned 1990s red-brick industrial factory building facing the viewer, with rusted iron double gates and a faded plaque above reading "第三印染厂" in clear simplified Chinese characters.
2. Top right-centre (blue block with pink, yellow and teal ovals): a stone-rimmed industrial retention pond filled with surreal, glowing iridescent rainbow dye swirls (magenta, gold, cyan, and deep blue) where quantized city colours have pooled.
3. Far left above the road (small grey block): a large rusted iron pipeline and wheel valve emerging from the weeds.
4. Across the middle (tan horizontal band): a flat, completely unobstructed gravel and dirt road entering from the LEFT edge and running right until it stops at the green border.
5. Bottom lawn (where the white dashed rectangle is): a surreal unfinished architectural structure made ONLY of glowing white 2D wireframe lines drawn over the grass (an unrendered wireframe pavilion with no solid walls).
6. Far RIGHT edge (the jagged bright #00FF00 green zone): a surreal meta-art Tear at the edge of the world where the painted pixel world abruptly ends in a jagged white torn-paper border, revealing flat, unrendered pure chroma-key green (#00FF00) with a faint pixel grid on the rightmost 15% of the image.`;

  await Promise.all([
    runScene('city_overpass', overpassCleanSvg, overpassAnnotatedSvg, overpassPrompt, overpassWalkable, overpassBlocked, overpassTriggers, overpassExits),
    runScene('suburb_dyeworks', suburbCleanSvg, suburbAnnotatedSvg, suburbPrompt, suburbWalkable, suburbBlocked, suburbTriggers, suburbExits),
  ]);
}

main();
