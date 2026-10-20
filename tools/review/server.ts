import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { plainText } from '../../src/engine/handwriting.ts';
import type { CastMember } from '../../src/engine/content.ts';
import { inRect, type FieldMap, type MapExit, type MapTrigger } from '../../src/engine/map.ts';
import { facingVec, REACH, walkableFoot, type Facing, type Vec } from '../../src/engine/walk.ts';
import { compileInk } from '../lib/ink.ts';
import { sourceLines } from '../lib/content.ts';
import {
  APPROVALS_PATH, isLegacyAsset, loadApprovals, reviewAssets, serializeApprovals, type ApprovalStatus, type ReviewAsset,
} from '../lib/approvals.ts';

const ROOT = process.cwd();
const port = Number(process.env.PORT ?? 5174);
const cast = parse(readFileSync(join(ROOT, 'content/cast/cast.yaml'), 'utf8')) as Record<string, CastMember>;
const bootSource = readFileSync(join(ROOT, 'src/game/scenes/Boot.ts'), 'utf8');
const frameRate = Number(/frameRate:\s*(\d+)/.exec(bootSource)?.[1] ?? 7);
const configSource = readFileSync(join(ROOT, 'src/game/config.ts'), 'utf8');
const heights = /\bACTOR_HEIGHT[^=]*=\s*\{([^}]+)\}/.exec(configSource)?.[1] ?? '';
const actorHeights = Object.fromEntries([...heights.matchAll(/(\w+)\s*:\s*(\d+)/g)].map(([, id, height]) => [id, Number(height)]));
const handSizes: Record<string, number> = { song: 22, kai: 26, brush: 28, xing: 28, rough: 26 };
const storyBuild = compileInk(join(ROOT, 'content/story/main.ink'));
const story = sourceLines(storyBuild.files);
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function fileUrl(path: string | undefined): string | null {
  return path && existsSync(join(ROOT, path)) ? `/__file/${path.replaceAll('\\', '/')}` : null;
}

function findFiles(dir: string, predicate: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? findFiles(path, predicate) : predicate(path) ? [path] : [];
  });
}

function findManifest(map: FieldMap): { prompt?: string; sourceImageUrl?: string; comment?: string; rawUrl?: string } {
  if (map.background === 'bg_scriptorium') {
    const scene = JSON.parse(readFileSync(join(ROOT, 'assets/scenes/ming_scriptorium.yaml'), 'utf8')) as { pano: string; clean: string };
    return {
      prompt: 'Scene-first plate: supplied pano with Shen and Kuang erased only inside their measured boxes; seated poses are extracted from the same plate.',
      comment: 'Scene cut from assets/scenes/ming_scriptorium.yaml. The clean edit is restricted to the two measured erase boxes.',
      sourceImageUrl: fileUrl(scene.clean) ?? undefined,
      rawUrl: fileUrl(scene.pano) ?? undefined,
    };
  }
  const manifestFiles = findFiles(join(ROOT, 'assets/manifest'), (path) => path.endsWith('.yaml') || path.endsWith('.yml'));
  const expectedId = `${map.art ?? 'retro'}/${map.background}`;
  for (const path of manifestFiles) {
    const manifest = parse(readFileSync(path, 'utf8')) as { items?: Array<{ id?: string; out?: string; prompt?: string }> };
    const item = manifest.items?.find((entry) =>
      entry.out === `public/art/${map.art ?? 'retro'}/${map.background}.png`
      || entry.id === expectedId || entry.id === map.background);
    if (!item) continue;
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const outLine = lines.find((line) => item.out && line.includes(item.out));
    const comment = outLine?.split('#').slice(1).join('#').trim();
    let sourcePath = item.out;
    if (sourcePath?.startsWith('public/art/')) {
      const signs = readFileSync(join(ROOT, 'tools/art/hant-signs.py'), 'utf8');
      const match = new RegExp(`"src":\\s*"([^"]+)"[\\s\\S]*?"out":\\s*"${sourcePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).exec(signs);
      sourcePath = match?.[1] ?? sourcePath;
    }
    const raw = findFiles(join(ROOT, 'assets/raw'), (candidate) =>
      candidate.endsWith(`/${map.background}.png`) || candidate.endsWith(`/${item.id?.split('/').at(-1)}.png`))[0];
    return {
      prompt: item.prompt,
      sourceImageUrl: sourcePath?.startsWith('assets/bg/') ? fileUrl(sourcePath) ?? undefined : undefined,
      comment,
      rawUrl: raw ? fileUrl(relative(ROOT, raw)) ?? undefined : undefined,
    };
  }
  return {};
}

function handLines(handId: string): string[] {
  const alias = new Map<string, string>();
  for (const [id, member] of Object.entries(cast)) {
    alias.set(id, id);
    alias.set(member.name, id);
  }
  return story.flatMap((line) => {
    const speaker = /^([^:：]{1,20})\s*[:：]/.exec(line.text)?.[1];
    const id = speaker ? alias.get(speaker) : undefined;
    const hand = id ? cast[id]?.hand ?? 'kai' : 'song';
    const spoken = plainText(line.text).replace(/\s+#(?:[a-z][\w-]*)\b/g, '').replace(/^[^:：]{1,20}\s*[:：]\s*/, '').trim();
    return hand === handId ? [spoken] : [];
  });
}

function missingGlyphs(fontPath: string, lines: string[]): string[] {
  if (!existsSync(join(ROOT, fontPath))) return [];
  const program = 'from fontTools.ttLib import TTFont; import sys; f=TTFont(sys.argv[1]); c=f.getBestCmap() or {}; t=sys.argv[2]; print("".join(sorted(set(x for x in t if ord(x)>127 and ord(x) not in c))))';
  const result = spawnSync('python3', ['-c', program, join(ROOT, fontPath), lines.join('')], { encoding: 'utf8' });
  return result.status === 0 ? [...new Set(result.stdout.trim())] : [];
}

interface StampPoint {
  kind: 'trigger' | 'exit' | 'extreme' | 'actor';
  label: string;
  actorId?: string;
  x: number;
  y: number;
  face: Facing;
  valid: boolean;
}

function triggerHit(map: FieldMap, trigger: MapTrigger, point: Vec, face: Facing): boolean {
  const facing = facingVec(face);
  const probe = { x: point.x + facing.x * REACH, y: point.y + facing.y * REACH };
  if (map.view === 'side') {
    const above = { x: point.x, y: point.y - REACH };
    const faceOk = !trigger.face || trigger.face === 'up' || trigger.face === 'down' || trigger.face === face;
    return faceOk && [point, above, probe].some((candidate) => inRect(candidate, trigger));
  }
  return trigger.face
    ? trigger.face === face && inRect(probe, trigger)
    : inRect(probe, trigger) || inRect(point, trigger);
}

function candidateRange(rect: MapTrigger, face: Facing) {
  const vector = facingVec(face);
  return {
    x1: rect.x - vector.x * REACH,
    x2: rect.x + rect.width - vector.x * REACH,
    y1: rect.y - vector.y * REACH,
    y2: rect.y + rect.height - vector.y * REACH,
  };
}

function topTriggerStand(map: FieldMap, trigger: MapTrigger): { point: Vec; face: Facing } | null {
  const faces: Facing[] = trigger.face ? [trigger.face as Facing] : ['up', 'down', 'left', 'right'];
  const candidates: Array<{ point: Vec; face: Facing; distance: number }> = [];
  for (const face of faces) {
    const range = candidateRange(trigger, face);
    const x1 = Math.max(0, Math.ceil(Math.min(range.x1, range.x2)));
    const x2 = Math.min(map.width, Math.floor(Math.max(range.x1, range.x2)));
    const y1 = Math.max(0, Math.ceil(Math.min(range.y1, range.y2)));
    const y2 = Math.min(map.height, Math.floor(Math.max(range.y1, range.y2)));
    const center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const point = { x, y };
        if (!walkableFoot(point, map.walkable, map.blocked) || !triggerHit(map, trigger, point, face)) continue;
        candidates.push({ point, face, distance: (x - center.x) ** 2 + (y - center.y) ** 2 });
      }
    }
  }
  if (!trigger.face) {
    const center = { x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height / 2 };
    for (let y = Math.max(0, Math.ceil(trigger.y)); y <= Math.min(map.height, Math.floor(trigger.y + trigger.height)); y++) {
      for (let x = Math.max(0, Math.ceil(trigger.x)); x <= Math.min(map.width, Math.floor(trigger.x + trigger.width)); x++) {
        const point = { x, y };
        if (walkableFoot(point, map.walkable, map.blocked) && triggerHit(map, trigger, point, 'down')) {
          candidates.push({ point, face: 'down', distance: (x - center.x) ** 2 + (y - center.y) ** 2 });
        }
      }
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] ? { point: candidates[0].point, face: candidates[0].face } : null;
}

function sideTriggerStand(map: FieldMap, trigger: MapTrigger): { point: Vec; face: Facing } | null {
  const x = trigger.x + trigger.width / 2;
  const faces: Facing[] = trigger.face === 'left' || trigger.face === 'right'
    ? [trigger.face]
    : ['right', 'left'];
  for (let y = Math.max(0, Math.ceil(trigger.y + trigger.height)); y <= map.height; y++) {
    const point = { x, y };
    if (!walkableFoot(point, map.walkable, map.blocked)) continue;
    const face = faces.find((candidate) => triggerHit(map, trigger, point, candidate));
    if (face) return { point, face };
  }
  return null;
}

function exitStand(map: FieldMap, exit: MapExit): { point: Vec; face: Facing } | null {
  const center = { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 };
  let nearest: { point: Vec; face: Facing; distance: number } | null = null;
  for (let y = Math.max(0, Math.ceil(exit.y)); y <= Math.min(map.height, Math.floor(exit.y + exit.height)); y++) {
    for (let x = Math.max(0, Math.ceil(exit.x)); x <= Math.min(map.width, Math.floor(exit.x + exit.width)); x++) {
      const point = { x, y };
      if (!walkableFoot(point, map.walkable, map.blocked)) continue;
      const distance = (x - center.x) ** 2 + (y - center.y) ** 2;
      if (!nearest || distance < nearest.distance) nearest = { point, face: 'right', distance };
    }
  }
  return nearest;
}

function stampPoints(map: FieldMap): StampPoint[] {
  const triggers = map.triggers.map((trigger) => {
    const stand = map.view === 'side' ? sideTriggerStand(map, trigger) : topTriggerStand(map, trigger);
    const point = stand?.point ?? { x: trigger.x + trigger.width / 2, y: trigger.y + trigger.height + REACH };
    return { kind: 'trigger' as const, label: trigger.knot, x: point.x, y: point.y, face: stand?.face ?? 'right', valid: !!stand };
  });
  const exits = map.exits.map((exit) => {
    const stand = exitStand(map, exit);
    const point = stand?.point ?? { x: exit.x + exit.width / 2, y: exit.y + exit.height / 2 };
    return { kind: 'exit' as const, label: `${exit.map}:${exit.anchor}`, x: point.x, y: point.y, face: stand?.face ?? 'right', valid: !!stand };
  });
  const vertices = map.walkable.flat();
  const minX = Math.min(...vertices.map((p) => p.x));
  const maxX = Math.max(...vertices.map((p) => p.x));
  const minY = Math.min(...vertices.map((p) => p.y));
  const maxY = Math.max(...vertices.map((p) => p.y));
  const sideView = map.view === 'side';
  const topPoly = map.walkable.find((poly) => Math.min(...poly.map((p) => p.y)) === minY) ?? map.walkable[0];
  const bottomPoly = map.walkable.find((poly) => Math.max(...poly.map((p) => p.y)) === maxY) ?? map.walkable[0];
  const centerAtY = (poly: typeof map.walkable[number], y: number) => {
    const points = poly.filter((p) => p.y === y);
    return points.reduce((sum, p) => sum + p.x, 0) / points.length;
  };
  const extremes: StampPoint[] = map.frameInset ? [
    { kind: 'extreme' as const, label: 'walkable left', x: minX + 15, y: sideView ? (minY + maxY) / 2 : 350, face: 'right' as Facing, valid: true },
    { kind: 'extreme' as const, label: 'walkable right', x: maxX - 15, y: sideView ? (minY + maxY) / 2 : 350, face: 'left' as Facing, valid: true },
    { kind: 'extreme' as const, label: 'walkable top', x: sideView ? centerAtY(topPoly, minY) : 125, y: minY + 11, face: 'right' as Facing, valid: true },
    { kind: 'extreme' as const, label: 'walkable bottom', x: sideView ? centerAtY(bottomPoly, maxY) : 500, y: sideView ? maxY - 10 : 500, face: 'right' as Facing, valid: true },
  ].map((p) => ({ ...p, valid: walkableFoot(p, map.walkable, map.blocked) })) : [];
  const actors = sideView ? map.actors.map((actor) => ({
    kind: 'actor' as const, actorId: actor.id, label: `actor position ${actor.id}`, x: actor.x, y: actor.y,
    face: (actor.face ?? 'right') as Facing, valid: walkableFoot({ x: actor.x, y: actor.y }, map.walkable, map.blocked),
  })) : [];
  return [...extremes, ...triggers, ...exits, ...actors];
}

function cardData(asset: ReviewAsset): Record<string, unknown> {
  if (asset.kind === 'layer') {
    return { ...asset.data, imageUrl: fileUrl(asset.path) };
  }
  if (asset.kind === 'bg') {
    const map = asset.data.map as FieldMap;
    const mapId = String(asset.data.mapId);
    const scenePath = mapId === 'ming_scriptorium'
      ? join(ROOT, 'assets/scenes/ming_scriptorium.yaml')
      : null;
    const scene = scenePath
      ? JSON.parse(readFileSync(scenePath, 'utf8')) as {
        pose_min_changed_pixels?: number;
        retouched?: string;
        figures: Record<string, { figure: number[]; height_art: number; feet_art: [number, number] }>;
      }
      : null;
    const actors = [...new Set([map.player, ...map.actors.map((actor) => actor.id)])].map((id) => ({
      id, member: cast[id], imageUrl: fileUrl(`public/art/${cast[id]?.art ?? map.art ?? 'retro'}/${cast[id]?.sprite}.png`),
    }));
    return {
      ...asset.data,
      actors,
      manifest: findManifest(map),
      backgroundUrl: fileUrl(asset.path),
      reach: REACH,
      stampPoints: stampPoints(map),
      poseMinChangedPixels: scene?.pose_min_changed_pixels ?? 100,
      paintedFigures: scene
        ? Object.entries(scene.figures).map(([id, figure]) => ({
          id, figure: figure.figure, height: figure.height_art, feet: figure.feet_art, name: cast[id]?.name, member: cast[id],
          spriteUrl: fileUrl(`public/art/${cast[id]?.art ?? map.art}/${cast[id]?.sprite}.png`),
          sourceUrl: fileUrl(scene.retouched ?? 'assets/raw/ming/scriptorium_pano.png'),
        }))
        : [],
    };
  }
  if (asset.kind === 'sprite' || asset.kind === 'pose') {
    const member = asset.data.member as CastMember;
    if (asset.kind === 'pose') {
      const layout = JSON.parse(readFileSync(join(ROOT, 'assets/scenes/ming_scriptorium.art.json'), 'utf8')) as {
        poses: Record<string, { origin: [number, number] }>;
      };
      return {
        ...asset.data,
        imageUrl: fileUrl(asset.path),
        plateUrl: fileUrl('public/art/ming/bg_scriptorium.png'),
        origin: layout.poses[String(asset.data.castId)]?.origin ?? null,
      };
    }
    const sameArt = Object.entries(cast).filter(([, other]) => (other.art ?? 'retro') === (member.art ?? 'retro')).map(([id, other]) => ({
      id, name: other.name, height: other.height ?? actorHeights[id] ?? 110, sheet: other.sheet ?? 'walk4',
      imageUrl: fileUrl(`public/art/${other.art ?? 'retro'}/${other.sprite}.png`),
    }));
    return { ...asset.data, imageUrl: fileUrl(asset.path), sameArt, frameRate };
  }
  const handId = String(asset.data.handId);
  const lines = handLines(handId);
  const candidates = [
    { name: '芫荽 Iansui', role: '僧人抄經／手寫楷體', license: 'SIL OFL 1.1', source: 'https://github.com/ButTaiwan/iansui', licenseUrl: 'https://github.com/ButTaiwan/iansui/blob/main/OFL.txt', previewUrl: fileUrl('public/fonts/hands/candidates/brush.woff2'), selected: handId === 'brush' },
    { name: '辰宇落雁體', role: '文士行書／輕柔手稿', license: 'SIL OFL 1.1', source: 'https://github.com/Chenyu-otf/chenyuluoyan_thin', licenseUrl: 'https://github.com/Chenyu-otf/chenyuluoyan_thin/blob/main/license.txt', previewUrl: fileUrl('public/fonts/hands/candidates/xing.woff2'), selected: handId === 'xing' },
    { name: 'LXGW WenKai TC', role: '繁體楷手寫；外邦書吏用字', license: 'SIL OFL 1.1', source: 'https://github.com/lxgw/LxgwWenKaiTC', licenseUrl: 'https://github.com/lxgw/LxgwWenKaiTC/blob/main/OFL.txt', previewUrl: fileUrl('public/fonts/hands/candidates/kai.woff2'), selected: ['kai', 'rough'].includes(handId) },
    { name: '清松手寫體 JasonHandwriting', role: '候選；官方 README 稱 OFL，未找到授權文字檔', license: '未採用：授權檔未核實', source: 'https://github.com/jasonhandwriting/JasonHandwriting', licenseUrl: 'https://github.com/jasonhandwriting/JasonHandwriting', previewUrl: null, selected: false },
    { name: 'I.Ming 一點明體', role: '候選；未採用', license: 'IPA Font License Agreement v1.0（不符合 OFL/Apache 條件）', source: 'https://github.com/ichitenfont/I.Ming', licenseUrl: 'https://github.com/ichitenfont/I.Ming/blob/master/LICENSE.md', previewUrl: null, selected: false },
    { name: 'Ma Shan Zheng / Zhi Mang Xing / Long Cang', role: '舊字型；繁體缺字，已淘汰', license: 'SIL OFL 1.1', source: 'https://fonts.google.com/', licenseUrl: 'https://github.com/google/fonts', previewUrl: null, selected: false },
  ];
  return { ...asset.data, fontUrl: fileUrl(asset.path), fontSize: handSizes[handId] ?? 26, lines, missingGlyphs: missingGlyphs(asset.path, lines), candidates };
}

function reply(res: import('node:http').ServerResponse, status: number, value: unknown, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*' });
  res.end(Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/') {
    return reply(res, 200, readFileSync(join(ROOT, 'tools/review/index.html'), 'utf8'), mime['.html']);
  }
  if (req.method === 'GET' && url.pathname === '/api/assets') {
    return reply(res, 200, reviewAssets(ROOT).map((asset) => ({ ...asset, data: cardData(asset) })));
  }
  if (req.method === 'POST' && url.pathname === '/api/decision') {
    let body = '';
    for await (const chunk of req) body += chunk.toString();
    if (body.length > 20_000) return reply(res, 413, { error: 'request too large' });
    let input: { key?: string; status?: ApprovalStatus; note?: string };
    try { input = JSON.parse(body) as typeof input; } catch { return reply(res, 400, { error: 'invalid JSON' }); }
    const allowed: ApprovalStatus[] = ['pending', 'approved', 'rejected'];
    const asset = reviewAssets(ROOT).find((entry) => entry.key === input.key);
    if (!asset || !input.status || !allowed.includes(input.status)) return reply(res, 400, { error: 'unknown key or decision' });
    const approvals = loadApprovals(ROOT);
    const previous = approvals[asset.key];
    approvals[asset.key] = {
      status: input.status, hash: asset.hash, note: input.note ?? '', at: new Date().toISOString().slice(0, 10),
      legacy: previous?.legacy ?? isLegacyAsset(ROOT, asset.path),
      history: [...(previous?.history ?? []), ...(previous ? [{ status: previous.status, hash: previous.hash, note: previous.note, at: previous.at }] : [])],
    };
    writeFileSync(join(ROOT, APPROVALS_PATH), serializeApprovals(approvals));
    return reply(res, 200, { key: asset.key, decision: approvals[asset.key], stale: false });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/__file/')) {
    const relativePath = decodeURIComponent(url.pathname.slice('/__file/'.length));
    const path = resolve(ROOT, relativePath);
    if (!path.startsWith(`${ROOT}/`) || !existsSync(path)) return reply(res, 404, 'not found', 'text/plain');
    return reply(res, 200, readFileSync(path), mime[extname(path)] ?? 'application/octet-stream');
  }
  reply(res, 404, { error: 'not found' });
});
server.listen(port, '0.0.0.0', () => console.log(`asset review listening on http://0.0.0.0:${port}`));
