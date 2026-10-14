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

const bible = readFileSync(join(ROOT, 'assets/style/bible-campus.md'), 'utf8');
const cityRef = readFileSync(join(RETRO, 'bg_city_tenement.png'));

const backalleySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960">
  <rect width="540" height="960" fill="#4b4d50"/>
  <rect x="0" y="300" width="190" height="660" fill="#853f34" stroke="#241a18" stroke-width="5"/>
  <rect x="350" y="275" width="190" height="685" fill="#70443c" stroke="#241a18" stroke-width="5"/>
  <rect x="0" y="125" width="210" height="175" fill="#77736c"/>
  <rect x="155" y="260" width="170" height="190" fill="#77736c"/>
  <rect x="65" y="420" width="410" height="245" fill="#8b867d" stroke="#5b554e" stroke-width="4"/>
  <rect x="195" y="625" width="150" height="335" fill="#77736c"/>
  <rect x="190" y="415" width="155" height="235" fill="#8b867d"/>
  <rect x="85" y="465" width="56" height="86" fill="#a3a29b" stroke="#464441" stroke-width="4"/>
  <circle cx="123" cy="492" r="5" fill="#536b74"/>
  <rect x="420" y="475" width="48" height="92" fill="#422e27" stroke="#231915" stroke-width="4"/>
  <rect x="385" y="515" width="55" height="65" fill="#52575a" stroke="#2e3032" stroke-width="4"/>
  <rect x="350" y="350" width="90" height="92" fill="#655a50" stroke="#292521" stroke-width="4"/>
  <path d="M360 440 L430 350 M374 440 L444 350 M356 420 L438 420 M360 395 L432 395 M367 370 L425 370" fill="none" stroke="#252321" stroke-width="5"/>
  <path d="M120 325 L440 325 M125 348 L440 348 M145 306 L145 365 M225 306 L225 365 M335 306 L335 365" fill="none" stroke="#332925" stroke-width="4"/>
  <path d="M170 330 L195 370 L215 370 L238 330 M260 350 L283 390 L310 390 L330 350" fill="#ba8880" stroke="#4d3430" stroke-width="3"/>
  <path d="M0 195 C80 165 150 220 230 185 S370 210 540 160 M0 225 C100 245 180 195 270 220 S410 195 540 230" fill="none" stroke="#302d2d" stroke-width="3"/>
  <path d="M216 790 L324 790 M216 820 L324 820" stroke="#b5ada1" stroke-width="3"/>
</svg>`;

const kioskSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="408">
  <rect width="720" height="408" fill="#b8a886"/>
  <rect x="16" y="14" width="688" height="378" fill="#d2bd91" stroke="#493a2b" stroke-width="8"/>
  <rect x="28" y="24" width="664" height="30" fill="#7b412f"/>
  <rect x="260" y="56" width="240" height="76" fill="#6e4937" stroke="#32251e" stroke-width="6"/>
  <rect x="280" y="74" width="200" height="46" fill="#8a5b3f"/>
  <path d="M310 110 Q350 78 385 105 Q415 78 450 109" fill="none" stroke="#d7c5a2" stroke-width="10"/>
  <rect x="530" y="168" width="134" height="146" fill="#729093" stroke="#28393b" stroke-width="6"/>
  <rect x="542" y="180" width="110" height="120" fill="#9fc1bd" stroke="#d9e2dc" stroke-width="4"/>
  <rect x="590" y="198" width="8" height="80" fill="#e5e0cb"/>
  <rect x="238" y="162" width="82" height="154" fill="#775037" stroke="#3f2c20" stroke-width="5"/>
  <rect x="420" y="158" width="82" height="158" fill="#775037" stroke="#3f2c20" stroke-width="5"/>
  <path d="M248 178 H310 M248 211 H310 M248 244 H310 M248 277 H310 M430 176 H492 M430 210 H492 M430 244 H492 M430 278 H492" stroke="#d3a45e" stroke-width="7"/>
  <rect x="328" y="350" width="64" height="42" fill="#6e4937" stroke="#372820" stroke-width="5"/>
  <rect x="320" y="384" width="80" height="24" fill="#a8d0c9" stroke="#263e41" stroke-width="5"/>
  <path d="M330 384 V405 M390 384 V405" stroke="#ffffff" stroke-width="4"/>
  <rect x="266" y="352" width="48" height="34" fill="#b58c59" stroke="#473421" stroke-width="4"/>
  <rect x="404" y="142" width="40" height="22" fill="#9d3527"/>
  <rect x="660" y="190" width="26" height="120" fill="#e5d5ad"/>
  <rect x="34" y="62" width="652" height="14" fill="#f2dfb0"/>
</svg>`;

interface PilotMap {
  id: string;
  svg: string;
  width: number;
  height: number;
  aspectRatio: string;
  prompt: string;
}

const maps: PilotMap[] = [
  {
    id: 'city_backalley',
    svg: backalleySvg,
    width: 540,
    height: 960,
    aspectRatio: '9:16',
    prompt: `
ASSET: retro/bg_city_backalley
Portrait RPG field map, one continuous scene, no game characters. Use the first reference image for the exact nostalgic 1990s Chinese old-city palette, painterly pixel texture, lighting and high-angle 3/4 game-map style. Use the second image as the strict spatial blockout; preserve the connected walkable lane and courtyard layout.
This is a vertical overhead-ish 3/4 view of the back walls of two old red-brick Chinese walk-up apartment buildings, with the player looking down into a narrow stone lane. The lane enters OPEN from the bottom edge, only about 300 world pixels wide, runs north between the back walls, opens halfway into a small shared courtyard, then bends west and exits OPEN through the LEFT edge in the upper part of the image (around y=250–550 world pixels). Both exits are painted as clear, unobstructed continuations of the stone path: do not put doors, walls, staircases, poles, signs, laundry or shadows across either opening.
The west courtyard wall has a shared concrete wash basin with a dripping tap and three enamel wash tubs. On the east wall is the back door of Lao Ji's repair shop, with a neat stack of used e-bike batteries beside it. In the north-east corner is an exterior iron stair up to the second floor; its top landing is closed by a locked gate and is not a path. Red-brick apartment back walls, old drainpipes, bamboo laundry poles with a few faded clothes, tangled overhead utility wires, air conditioners and lived-in 1990s details. Let the vertical path and its westward turn read clearly at a glance. Put laundry poles, hanging clothes and wires above the open ground, never blocking the two exits. No English words, no UI, no borders.
`,
  },
  {
    id: 'avenue_kiosk',
    svg: kioskSvg,
    width: 720,
    height: 408,
    aspectRatio: '16:9',
    prompt: `
ASSET: retro/bg_avenue_kiosk
RPG field map interior, no game UI. Use the first reference image for the same warm, nostalgic 1990s Chinese pixel-art palette and high-angle 3/4 perspective. Use the second image as the strict spatial blockout; match the room footprint and keep the aisles open.
A small Jiangcheng University campus convenience store interior, viewed from above in a readable 3/4 top-down game-map perspective, with warm fluorescent lighting. The glass entrance is at the BOTTOM CENTRE and is visibly open to the pavement; the clear entrance aisle leads north. Two long rows of waist-high shelves of instant noodles and snacks sit in the middle, leaving broad walkable aisles between them and around them. On the east wall is a glass-door chest freezer with orange soda and green-bean ice lollies, clearly visible from its west approach. Along the north wall is the cashier counter; behind it a young clerk, Xiao Jiang, is asleep with her head resting on folded arms on the counter, painted as a small part of the background. A rack of little dried-fish packets sits beside the till. Signage is Chinese only: a clear sign reading “江城大学 校园超市” and a smaller “冷饮” sign above the freezer. No English text, no standing customers, no blocked entrance, no shelves across the entrance-to-counter aisle, no border or UI.
`,
  },
];

function nextRawPath(id: string) {
  for (let attempt = 1; ; attempt++) {
    const path = join(OUT, `${id}_raw_gemini_${String(attempt).padStart(2, '0')}.png`);
    if (!existsSync(path)) return path;
  }
}

async function generateMap(map: PilotMap) {
  const blockoutPath = join(OUT, `${map.id}_1_blockout_clean.png`);
  const postPath = join(OUT, `${map.id}_2_retro_bg.png`);
  const retroPath = join(RETRO, `bg_${map.id}.png`);
  await sharp(Buffer.from(map.svg)).png().toFile(blockoutPath);
  if (existsSync(retroPath) && !process.argv.includes('--force')) return;

  console.log(`[${map.id}] Generating via gemini-3-pro-image...`);
  const raw = await generateImage({
    model: 'gemini-3-pro-image',
    prompt: `${bible.trim()}\n\n---\n${map.prompt.trim()}`,
    refs: [
      { mimeType: 'image/png', data: cityRef },
      { mimeType: 'image/png', data: readFileSync(blockoutPath) },
    ],
    aspectRatio: map.aspectRatio,
    imageSize: '2K',
  });
  const rawPath = nextRawPath(map.id);
  writeFileSync(rawPath, raw);
  const post = await runPost(raw, [
    { resize: { width: map.width, height: map.height, fit: 'fill' } },
    { quantize: { colors: 128 } },
  ]);
  writeFileSync(postPath, post);
  writeFileSync(retroPath, post);
  console.log(`[${map.id}] Raw -> ${rawPath}`);
  console.log(`[${map.id}] Saved -> ${retroPath}`);
}

await Promise.all(maps.map(generateMap));
