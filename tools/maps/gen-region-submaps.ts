/**
 * Generates the connected multi-map sub-scenes for Old City (老城区) and Suburb (市郊荒原),
 * plus stitched regional panoramas and a full 10-map World Atlas overview image:
 *   - Old City Region (3 connected screens):
 *       1. city_overpass (九号高架桥底)
 *       2. city_tenement (背街筒子楼与旧书报亭)
 *       3. city_ferry    (江滩轮渡码头)
 *   - Suburb Region (3 connected screens):
 *       1. suburb_wireframe  (烂尾线稿别墅区与排污泵站)
 *       2. suburb_dyeworks   (第三印染厂与五彩排污池)
 *       3. suburb_breakwater (绿幕防波堤与世界尽头)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { generateImage } from '../lib/gemini.ts';
import { runPost } from '../lib/image.ts';

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
const RETRO = join(ROOT, 'public/art/retro');
mkdirSync(OUT, { recursive: true });

const W = 960;
const H = 540;
const bible = readFileSync(join(ROOT, 'assets/style/bible-campus.md'), 'utf8');
const cityRef = readFileSync(join(RETRO, 'bg_city_overpass.png'));
const suburbRef = readFileSync(join(RETRO, 'bg_suburb_dyeworks.png'));

// ============================================================================
// 1. city_tenement: 老城区 · 背街筒子楼与旧书摊 (connects city_overpass <-> city_ferry)
// ============================================================================
const tenementCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Urban ground base -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="#3d434a"/>
  <!-- North alley passage on left-centre (x: 340..440, y: 0..250) -->
  <rect x="330" y="0" width="110" height="255" fill="#686e75" stroke="#8b9198" stroke-width="2"/>
  <!-- Upper sidewalk -->
  <rect x="0" y="210" width="${W}" height="44" fill="#8f9499"/>
  <!-- Main asphalt street (aligned with city_overpass y=250..416) -->
  <rect x="0" y="254" width="${W}" height="162" fill="#7c8288"/>
  <rect x="0" y="250" width="${W}" height="12" fill="#a8a299"/>
  <rect x="0" y="416" width="${W}" height="12" fill="#a8a299"/>
  <!-- Lower tiled sidewalk -->
  <rect x="0" y="428" width="${W}" height="112" fill="#969188"/>
  <!-- Left building: 90s red-brick 2D façade-only Tenement (筒子楼) with ground-floor Newsstand (旧书报亭) -->
  <rect x="30" y="10" width="290" height="205" fill="#9c4f41" stroke="#241815" stroke-width="3"/>
  <rect x="70" y="125" width="190" height="90" fill="#2e6b4e" stroke="#1b2620" stroke-width="2"/>
  <rect x="90" y="145" width="150" height="50" fill="#e8b256"/>
  <!-- Right building: Paper-thin side-wall tenement block with ground-floor Grocery/Video shop (百货杂货) -->
  <rect x="450" y="15" width="460" height="200" fill="#7c6c5f" stroke="#241e19" stroke-width="3"/>
  <rect x="510" y="125" width="180" height="90" fill="#3b5f82" stroke="#1c2733" stroke-width="2"/>
  <rect x="530" y="145" width="140" height="55" fill="#f0a848"/>
  <rect x="740" y="135" width="110" height="80" fill="#5c4233" stroke="#241913" stroke-width="2"/>
  <!-- Lower sidewalk props: stone chess table + 2 plane trees -->
  <ellipse cx="180" cy="445" rx="70" ry="55" fill="#487a38" stroke="#2d5222" stroke-width="2"/>
  <rect x="168" y="475" width="24" height="55" fill="#6e472b"/>
  <rect x="440" y="445" width="140" height="55" rx="6" fill="#8c877e" stroke="#33302c" stroke-width="2"/>
  <ellipse cx="800" cy="445" rx="70" ry="55" fill="#487a38" stroke="#2d5222" stroke-width="2"/>
  <rect x="788" y="475" width="24" height="55" fill="#6e472b"/>
</svg>`;

// ============================================================================
// 2. city_ferry: 老城区 · 江滩轮渡码头 (connects city_tenement <-> suburb_wireframe)
// ============================================================================
const ferryCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- River water at top right & urban ground -->
  <rect x="0" y="0" width="${W}" height="215" fill="#2f566e"/>
  <rect x="0" y="210" width="${W}" height="330" fill="#525861"/>
  <!-- Upper pier promenade -->
  <rect x="0" y="185" width="${W}" height="68" fill="#8f9499"/>
  <!-- Main asphalt/cobble street (aligned y=250..416 from left to right edge) -->
  <rect x="0" y="254" width="${W}" height="162" fill="#7c8288"/>
  <rect x="0" y="250" width="${W}" height="12" fill="#a8a299"/>
  <rect x="0" y="416" width="${W}" height="12" fill="#a8a299"/>
  <!-- Lower riverside walkway -->
  <rect x="0" y="428" width="${W}" height="112" fill="#8d887f"/>
  <!-- Top left: Old Concrete Flood-Control Wall & Ferry Ticket House (江城轮渡) -->
  <rect x="40" y="35" width="380" height="175" fill="#6b757d" stroke="#24292e" stroke-width="3"/>
  <rect x="150" y="115" width="160" height="95" fill="#3a6073" stroke="#1e2d36" stroke-width="2"/>
  <!-- Top right: Iron River Ferry Boat (铁壳渡船) moored at the concrete pier -->
  <polygon points="510,55 890,55 920,150 480,150" fill="#8c4a38" stroke="#261713" stroke-width="3"/>
  <rect x="570" y="25" width="240" height="75" fill="#d9cfc1" stroke="#332b22" stroke-width="2"/>
  <rect x="640" y="145" width="110" height="55" fill="#7a6248" stroke="#2b2117" stroke-width="2"/>
  <!-- Lower walkway props: mooring bollards, wooden crates, riverside lamp & bench -->
  <rect x="160" y="445" width="150" height="55" fill="#9c6b43" stroke="#2e1e12" stroke-width="2"/>
  <rect x="560" y="445" width="170" height="50" fill="#5b6670" stroke="#22272b" stroke-width="2"/>
</svg>`;

// ============================================================================
// 3. suburb_wireframe: 市郊 · 烂尾线稿别墅区与排污泵站 (connects city_ferry <-> suburb_dyeworks)
// ============================================================================
const wireframeCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Suburban marsh grass base -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="#596e42"/>
  <!-- Walkable gravel road across middle (aligned with suburb_dyeworks y=215..350) -->
  <rect x="0" y="220" width="${W}" height="130" fill="#b8aa93" stroke="#998b74" stroke-width="2"/>
  <!-- North courtyard clearing -->
  <rect x="120" y="155" width="720" height="70" fill="#a89f88"/>
  <!-- Top Left & Centre: Half-rendered & Wireframe Villa Complex (线稿别墅公社) -->
  <rect x="80" y="25" width="320" height="145" fill="#7a5244" stroke="#ffffff" stroke-width="3"/>
  <rect x="420" y="25" width="310" height="145" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="6"/>
  <!-- Campfire/chalk board in front of wireframe villa -->
  <rect x="490" y="135" width="140" height="45" fill="#d4843e" stroke="#ffffff" stroke-width="2"/>
  <!-- Top Right: Rusted Iron Pipeline running right to connect into suburb_dyeworks! -->
  <rect x="760" y="125" width="200" height="55" fill="#6b7075" stroke="#292c2e" stroke-width="2"/>
  <!-- South Lawn: Surveyor tripod, concrete pipes & glowing 2D wireframe garden arch -->
  <rect x="200" y="395" width="180" height="75" fill="#8c8c8c" stroke="#333333" stroke-width="2"/>
  <rect x="540" y="385" width="260" height="105" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="5"/>
</svg>`;

// ============================================================================
// 4. suburb_breakwater: 市郊 · 绿幕防波堤与世界尽头 (east of suburb_dyeworks)
// ============================================================================
const breakwaterCleanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- Left side: overgrown suburban ground & concrete breakwater pier -->
  <rect x="0" y="0" width="660" height="${H}" fill="#596e42"/>
  <!-- Concrete breakwater deck extending from left edge (y=215..360) toward the green void -->
  <rect x="0" y="210" width="720" height="155" fill="#94989c" stroke="#5c6063" stroke-width="3"/>
  <!-- North side: Construction barricade "清样重地" & stacked dye barrels -->
  <rect x="80" y="55" width="320" height="145" fill="#3b5c7a" stroke="#1f2e3d" stroke-width="3"/>
  <rect x="440" y="85" width="170" height="115" fill="#c96a38" stroke="#2e190d" stroke-width="2"/>
  <!-- South side: Concrete tetrapods (防波块) & surveyor telescope at the pier tip -->
  <rect x="140" y="390" width="360" height="95" fill="#7c8085" stroke="#2e3133" stroke-width="2"/>
  <rect x="610" y="245" width="75" height="75" fill="#d9a648" stroke="#2b210e" stroke-width="2"/>
  <!-- Right 32% & Top-Right: Massive jagged white torn-paper edge revealing flat #00FF00 Chroma-Key Void! -->
  <polygon points="640,0 960,0 960,540 580,540 605,450 675,380 725,355 735,215 660,175 670,85" fill="#00ff00" stroke="#ffffff" stroke-width="4"/>
</svg>`;

async function genMap(id: string, cleanSvg: string, refBuf: Buffer, promptBody: string) {
  const cleanPath = join(OUT, `${id}_1_blockout_clean.png`);
  const bgOutPath = join(OUT, `${id}_2_retro_bg.png`);
  const retroPath = join(RETRO, `bg_${id}.png`);

  await sharp(Buffer.from(cleanSvg)).png().toFile(cleanPath);
  if (!existsSync(retroPath) || process.argv.includes('--force')) {
    console.log(`[${id}] Generating via gemini-3-pro-image...`);
    const rawPng = await generateImage({
      model: 'gemini-3-pro-image',
      prompt: `${bible.trim()}\n\n---\n${promptBody.trim()}`,
      refs: [
        { mimeType: 'image/png', data: refBuf },
        { mimeType: 'image/png', data: readFileSync(cleanPath) },
      ],
      aspectRatio: '16:9',
      imageSize: '2K',
    });
    const postPng = await runPost(rawPng, [
      { resize: { width: 960, height: 540 } },
      { quantize: { colors: 128 } },
    ]);
    writeFileSync(bgOutPath, postPng);
    writeFileSync(retroPath, postPng);
    console.log(`[${id}] Saved -> ${retroPath}`);
  }
}

async function main() {
  const tenementPrompt = `
ASSET: retro/bg_city_tenement
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, building fronts face the viewer, horizontal ground lines), pixel art scale, dithering, and late-dusk nostalgic 1990s Chinese urban atmosphere.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions so the street connects seamlessly from the left edge to the right edge:
1. Across the middle (grey band y=250..416): a wide, completely unobstructed asphalt street running straight from the LEFT edge to the RIGHT edge at the exact same height as the first reference image, with tiled sidewalks above and below it.
2. Top left (reddish-brown block): a weathered 1990s red-brick Chinese residential tenement building (筒子楼) facing the viewer, with laundry poles on balconies and a ground-floor green wooden newsstand and old book stall with a signboard reading "旧书报亭" in clear simplified Chinese characters.
3. Top centre-left (grey vertical corridor between the two buildings): a narrow paved back-alley passage leading north between the buildings.
4. Top right (tan-brown block): an old residential building whose side edge looks surrealistically paper-thin like a stage flat, with a warm-lit ground-floor corner store reading "便民杂货" in clear simplified Chinese characters and an old wooden doorway beside it.
5. Along the bottom sidewalk strip: two plane trees on the left and right, and a round stone neighborhood chess table with stone stools in the middle.`;

  const ferryPrompt = `
ASSET: retro/bg_city_ferry
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, building fronts face the viewer, horizontal ground lines), pixel art scale, dithering, and late-dusk urban atmosphere.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Across the middle (grey band y=250..416): a wide, completely unobstructed paved pier road entering from the LEFT edge and running straight off the RIGHT edge at the exact same height as the reference street.
2. Top left (grey-blue block): a weathered concrete river flood-control wall and an old 1990s ferry ticket booth facing the viewer with a signboard reading "江城轮渡" in clear simplified Chinese characters.
3. Top right (dark blue river water with rust-red boat hull): the calm river surface where a vintage rust-red and cream iron river ferry boat (铁壳渡船) is moored parallel to the stone pier, connected by a wooden gangplank.
4. Along the bottom sidewalk strip: stacked wooden cargo crates and orange lifebuoys on the left, and an iron riverside bench and mooring bollards on the right.`;

  const wireframePrompt = `
ASSET: retro/bg_suburb_wireframe
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, horizontal ground lines), pixel art scale, marsh grass colours, and soft ordered dithering.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Across the middle (tan horizontal band): a flat, completely unobstructed gravel road running straight from the LEFT edge to the RIGHT edge at the exact same height as the first reference image.
2. Top left (brown block next to white dashed block): an unfinished suburban villa complex where the left half is painted 1990s red brick, and the right half is a surreal UNRENDERED 2D wireframe building made ONLY of glowing white architectural outlines over the grass, with a small warm campfire kettle and a drawing board at its entrance.
3. Top right (grey horizontal pipe block): a heavy rusted iron industrial pipeline emerging from a small brick pump box and running off the RIGHT edge of the image (matching the pipe height of the reference image).
4. Bottom lawn: stacked grey concrete drainage pipes on the left, and a surreal glowing white 2D wireframe courtyard arch and surveyor tripod on the right.`;

  const breakwaterPrompt = `
ASSET: retro/bg_suburb_breakwater
RPG field map, one continuous scene, no characters.
Use the FIRST reference image for the EXACT camera angle (straight-on high-angle 3/4 view, horizontal ground lines), pixel art scale, and soft ordered dithering.
Use the SECOND reference image as the STRICT spatial layout blockout — match every zone's exact position and proportions:
1. Across the middle from the LEFT edge (grey band): a weathered concrete breakwater pier road entering from the LEFT edge and extending right until it ends abruptly at the torn paper border.
2. Top left (blue-grey block and orange block): corrugated iron construction barriers with a faded sign reading "清样重地" in clear simplified Chinese characters, next to stacked colourful dye barrels and paint buckets.
3. Bottom left (grey block below the pier): concrete wave-breaker tetrapods along the grassy shore.
4. At the right tip of the concrete pier (small gold block): a brass surveyor's tripod telescope pointing toward the green void.
5. Far RIGHT 30% of the image (the bright #00FF00 polygon): a dramatic surreal meta-art Tear where the painted pixel world ends in a jagged white torn-paper border, revealing flat, unrendered pure chroma-key green (#00FF00) with a faint white 2D pixel grid and wireframe reef outlines.`;

  await Promise.all([
    genMap('city_tenement', tenementCleanSvg, cityRef, tenementPrompt),
    genMap('city_ferry', ferryCleanSvg, cityRef, ferryPrompt),
    genMap('suburb_wireframe', wireframeCleanSvg, suburbRef, wireframePrompt),
    genMap('suburb_breakwater', breakwaterCleanSvg, suburbRef, breakwaterPrompt),
  ]);
}

main();
