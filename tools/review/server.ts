import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { plainText } from '../../src/engine/handwriting.ts';
import type { CastMember } from '../../src/engine/content.ts';
import type { FieldMap } from '../../src/engine/map.ts';
import { compileInk } from '../lib/ink.ts';
import { sourceLines } from '../lib/content.ts';
import {
  APPROVALS_PATH, loadApprovals, reviewAssets, serializeApprovals, type ApprovalStatus, type ReviewAsset,
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

function cardData(asset: ReviewAsset): Record<string, unknown> {
  if (asset.kind === 'bg') {
    const map = asset.data.map as FieldMap;
    const actors = [...new Set([map.player, ...map.actors.map((actor) => actor.id)])].map((id) => ({
      id, member: cast[id], imageUrl: fileUrl(`public/art/${cast[id]?.art ?? map.art ?? 'retro'}/${cast[id]?.sprite}.png`),
    }));
    return {
      ...asset.data,
      actors,
      manifest: findManifest(map),
      backgroundUrl: fileUrl(asset.path),
      stampPoints: [
        ...map.triggers.map((trigger) => ({ kind: 'trigger' as const, x: trigger.x, y: trigger.y, width: trigger.width, height: trigger.height, face: trigger.face, label: trigger.knot })),
        ...map.exits.map((exit) => ({ kind: 'exit' as const, x: exit.x, y: exit.y, width: exit.width, height: exit.height, face: null, label: `${exit.map}:${exit.anchor}` })),
      ],
    };
  }
  if (asset.kind === 'sprite') {
    const member = asset.data.member as CastMember;
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
      legacy: previous?.legacy ?? asset.legacy,
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
