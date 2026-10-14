/**
 * Stitches all 10 interconnected maps into:
 *   1. docs/design-notes/images/region_1_campus_stitched.png  (4 screens: gate -> avenue -> library -> archive)
 *   2. docs/design-notes/images/region_2_city_stitched.png    (3 screens: city_overpass -> city_tenement -> city_ferry)
 *   3. docs/design-notes/images/region_3_suburb_stitched.png  (3 screens: suburb_wireframe -> suburb_dyeworks -> suburb_breakwater)
 *   4. docs/design-notes/images/world_atlas_stitched.png      (Full 10-map World Atlas overview)
 *   5. docs/design-notes/images/world_atlas_overlay.png       (Full 10-map World Atlas with 2D walkable/blocked/trigger/exit overlays)
 */
import { join } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';

const ROOT = join(import.meta.dirname, '../..');
const RETRO = join(ROOT, 'public/art/retro');
const OVERLAYS = '/home/ymiao/.hermes/cache/scratch/overlays';
const OUT = join(ROOT, 'docs/design-notes/images');

const W = 960;
const H = 540;

async function stitchRow(files: string[], outPath: string) {
  const composites = files.map((input, i) => ({ input, left: i * W, top: 0 }));
  await sharp({
    create: { width: files.length * W, height: H, channels: 4, background: { r: 20, g: 24, b: 30, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log('Saved:', outPath);
}

async function buildAtlas(srcDir: string, fileFn: (id: string) => string, outPath: string) {
  const campusIds = ['gate', 'avenue', 'library', 'archive'];
  const cityIds = ['city_overpass', 'city_tenement', 'city_ferry'];
  const suburbIds = ['suburb_wireframe', 'suburb_dyeworks', 'suburb_breakwater'];

  const atlasW = 4 * W + 80; // 3920
  const rowH = H + 70;
  const atlasH = 3 * rowH + 60; // 1890

  const headerSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${atlasW}" height="${atlasH}" font-family="sans-serif" font-weight="bold">
    <rect x="0" y="0" width="${atlasW}" height="${atlasH}" fill="#16191f"/>
    <!-- Region 1 Header -->
    <text x="40" y="42" fill="#f0d999" font-size="24">第一片区：江城大学旧校区（4 屏连片 · 7680x1080）：校门 — 梧桐苑 — 图书馆 — 校史馆与锅炉房</text>
    <!-- Region 2 Header -->
    <text x="40" y="${rowH + 42}" fill="#8ad4ff" font-size="24">第二片区：老城区高架桥与背街江滩（3 屏连片 · 5760x1080）：九号高架桥底 — 背街筒子楼 — 江滩轮渡码头</text>
    <!-- Region 3 Header -->
    <text x="40" y="${2 * rowH + 42}" fill="#7aff9e" font-size="24">第三片区：市郊印染厂与未渲染荒原（3 屏连片 · 5760x1080）：烂尾线稿别墅区 — 第三印染厂 — 绿幕防波堤</text>
  </svg>`;

  const composites: OverlayOptions[] = [{ input: Buffer.from(headerSvg), left: 0, top: 0 }];

  campusIds.forEach((id, i) => {
    composites.push({ input: join(srcDir, fileFn(id)), left: 40 + i * W, top: 60 });
  });
  cityIds.forEach((id, i) => {
    composites.push({ input: join(srcDir, fileFn(id)), left: 40 + i * W, top: rowH + 60 });
  });
  suburbIds.forEach((id, i) => {
    composites.push({ input: join(srcDir, fileFn(id)), left: 40 + i * W, top: 2 * rowH + 60 });
  });

  // Draw seam lines and connection arrows
  const seamSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${atlasW}" height="${atlasH}" font-family="sans-serif" font-weight="bold">
    ${[1, 2, 3].map((i) => `<line x1="${40 + i * W}" y1="60" x2="${40 + i * W}" y2="${60 + H}" stroke="#ffe066" stroke-width="3" stroke-dasharray="8"/>`).join('\n')}
    ${[1, 2].map((i) => `<line x1="${40 + i * W}" y1="${rowH + 60}" x2="${40 + i * W}" y2="${rowH + 60 + H}" stroke="#66ccff" stroke-width="3" stroke-dasharray="8"/>`).join('\n')}
    ${[1, 2].map((i) => `<line x1="${40 + i * W}" y1="${2 * rowH + 60}" x2="${40 + i * W}" y2="${2 * rowH + 60 + H}" stroke="#00ff66" stroke-width="3" stroke-dasharray="8"/>`).join('\n')}
  </svg>`;
  composites.push({ input: Buffer.from(seamSvg), left: 0, top: 0 });

  await sharp({
    create: { width: atlasW, height: atlasH, channels: 4, background: { r: 22, g: 25, b: 31, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log('Saved Atlas:', outPath);
}

async function main() {
  const campusIds = ['gate', 'avenue', 'library', 'archive'];
  const cityIds = ['city_overpass', 'city_tenement', 'city_ferry'];
  const suburbIds = ['suburb_wireframe', 'suburb_dyeworks', 'suburb_breakwater'];

  await stitchRow(
    campusIds.map((id) => join(RETRO, `bg_${id}.png`)),
    join(OUT, 'region_1_campus_stitched.png'),
  );
  await stitchRow(
    cityIds.map((id) => join(RETRO, `bg_${id}.png`)),
    join(OUT, 'region_2_city_stitched.png'),
  );
  await stitchRow(
    suburbIds.map((id) => join(RETRO, `bg_${id}.png`)),
    join(OUT, 'region_3_suburb_stitched.png'),
  );

  await buildAtlas(RETRO, (id) => `bg_${id}.png`, join(OUT, 'world_atlas_stitched.png'));
  await buildAtlas(OVERLAYS, (id) => `${id}.png`, join(OUT, 'world_atlas_overlay.png'));
}

main();
