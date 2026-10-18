import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import type { CastMember } from '../../src/engine/content.ts';
import { parseMap, type FieldMap } from '../../src/engine/map.ts';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Decision {
  status: ApprovalStatus;
  hash: string;
  note: string;
  at: string;
  legacy: boolean;
  history: Array<{ status: ApprovalStatus; hash: string; note: string; at: string }>;
}

export interface RequiredAsset {
  key: string;
  kind: 'bg' | 'sprite' | 'pose' | 'hand';
  hash: string;
  path: string;
  data: Record<string, unknown>;
}

export interface ReviewAsset extends RequiredAsset {
  decision?: Decision;
  stale: boolean;
}

export const APPROVALS_PATH = 'assets/approvals.yaml';
const LEGACY_NOTE = 'in main before the review flow';
const LEGACY_DATE = '2026-10-18';
const HANDS_PATH = 'public/fonts/hands';

const sha256 = (...parts: Uint8Array[]) => {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return hash.digest('hex').slice(0, 16);
};

function assetPath(root: string, file: string, art: string | null | undefined): string {
  return join(root, 'public', 'art', art ?? 'retro', `${file}.png`);
}

function placedIds(maps: Record<string, FieldMap>): string[] {
  return [...new Set(Object.values(maps).flatMap((map) => [map.player, ...map.actors.map((actor) => actor.id)]))].sort();
}

function mapSceneData(map: FieldMap) {
  return {
    walkable: map.walkable,
    blocked: map.blocked,
    triggers: map.triggers,
    foreground: map.foreground,
    anchors: map.anchors,
    actors: map.actors,
    exits: map.exits.map((exit) => ({ ...exit, face: exit.face ?? 'up' })),
    art: map.art,
    view: map.view,
    scaleFar: map.scaleFar,
    scaleNear: map.scaleNear,
    frameInset: map.frameInset,
    ...(map.paintedTitle ? { paintedTitle: true } : {}),
    script: map.script,
    player: map.player,
    dialogue: map.dialogue,
    intro: map.intro,
    ground: map.ground,
    width: map.width,
    height: map.height,
  };
}

export function loadApprovals(root = '.'): Record<string, Decision> {
  const path = join(root, APPROVALS_PATH);
  return existsSync(path) ? (parse(readFileSync(path, 'utf8')) as Record<string, Decision>) ?? {} : {};
}

export function requiredAssets(root = '.'): RequiredAsset[] {
  const mapDir = join(root, 'content/maps');
  const maps = Object.fromEntries(
    readDir(mapDir).filter((file) => file.endsWith('.tmj')).map((file) => [
      file.replace(/\.tmj$/, ''),
      parseMap(readFileSync(join(mapDir, file), 'utf8')),
    ]),
  ) as Record<string, FieldMap>;
  const cast = parse(readFileSync(join(root, 'content/cast/cast.yaml'), 'utf8')) as Record<string, CastMember>;
  const placed = placedIds(maps);
  const assets: RequiredAsset[] = [];

  for (const [id, map] of Object.entries(maps)) {
    const path = assetPath(root, map.background, map.art);
    const scenePath = id === 'ming_scriptorium'
      ? 'assets/scenes/ming_scriptorium'
      : id === 'ming_canal_street' ? 'assets/scenes/ming_canal_street' : null;
    const bundle = scenePath
      ? [
        readFileSync(join(root, `${scenePath}.yaml`)),
        readFileSync(join(root, `${scenePath}.art.json`)),
        ...[map.player, ...map.actors.map((actor) => actor.id)]
          .map((actorId) => readFileSync(assetPath(root, cast[actorId].sprite, cast[actorId].art))),
      ]
      : [];
    const hash = sha256(readFileSync(path), Buffer.from(JSON.stringify(mapSceneData(map))), ...bundle);
    assets.push({
      key: `bg:${id}`,
      kind: 'bg',
      hash,
      path: relative(root, path),
      data: { map, mapId: id, backgroundUrl: `/${relative(root, path).replaceAll('\\', '/')}` },
    });
  }

  const members = placed.filter((id) => cast[id]?.sheet !== 'pose');
  for (const id of members) {
    const member = cast[id];
    if (!member) continue;
    const path = assetPath(root, member.sprite, member.art);
    const signature = JSON.stringify({
      art: member.art ?? null,
      sheet: member.sheet ?? 'walk4',
      sprite: member.sprite,
      height: member.height ?? null,
    });
    assets.push({
      key: `sprite:${id}`,
      kind: 'sprite',
      hash: sha256(readFileSync(path), Buffer.from(signature)),
      path: relative(root, path),
      data: { castId: id, member, imageUrl: `/${relative(root, path).replaceAll('\\', '/')}` },
    });
  }

  for (const id of placed.filter((memberId) => cast[memberId]?.sheet === 'pose')) {
    const member = cast[id];
    if (!member) continue;
    const path = assetPath(root, member.sprite, member.art);
    const signature = JSON.stringify({ art: member.art ?? null, sheet: member.sheet, sprite: member.sprite, height: member.height ?? null });
    assets.push({
      key: `pose:${id}`,
      kind: 'pose',
      hash: sha256(readFileSync(path), Buffer.from(signature)),
      path: relative(root, path),
      data: { castId: id, member, imageUrl: `/${relative(root, path).replaceAll('\\', '/')}` },
    });
  }

  const bubbleMembers = new Set(
    Object.values(maps)
      .filter((map) => map.dialogue === 'bubble')
      .flatMap((map) => [map.player, ...map.actors.map((actor) => actor.id)]),
  );
  const handIds = new Set<string>();
  for (const id of bubbleMembers) handIds.add(cast[id]?.hand ?? 'kai');
  if (Object.values(maps).some((map) => map.dialogue === 'bubble' && map.art === 'ming')) handIds.add('song');
  for (const id of [...handIds].sort()) {
    const path = join(root, HANDS_PATH, `${id}.woff2`);
    assets.push({
      key: `hand:${id}`,
      kind: 'hand',
      hash: sha256(readFileSync(path)),
      path: relative(root, path),
      data: { handId: id, fontUrl: `/${relative(root, path).replaceAll('\\', '/')}` },
    });
  }
  return assets.sort((a, b) => a.key.localeCompare(b.key));
}

export function reviewAssets(root = '.'): ReviewAsset[] {
  const decisions = loadApprovals(root);
  return requiredAssets(root).map((asset) => {
    const decision = decisions[asset.key];
    return { ...asset, decision, stale: !!decision && decision.hash !== asset.hash };
  });
}

export function isLegacyAsset(root: string, path: string): boolean {
  const shown = spawnSync('git', ['show', `origin/main:${path.replaceAll('\\', '/')}`], {
    cwd: resolve(root),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (shown.status !== 0 || !Buffer.isBuffer(shown.stdout)) return false;
  try {
    return shown.stdout.equals(readFileSync(join(root, path)));
  } catch {
    return false;
  }
}

export function seedApprovals(root = '.', existing = loadApprovals(root)): Record<string, Decision> {
  const decisions: Record<string, Decision> = { ...existing };
  for (const asset of requiredAssets(root)) {
    const previous = existing[asset.key];
    const legacy = isLegacyAsset(root, asset.path);
    if (!legacy && previous && !previous.legacy) continue;
    decisions[asset.key] = {
      status: legacy ? 'approved' : 'pending',
      hash: asset.hash,
      note: legacy ? LEGACY_NOTE : '',
      at: LEGACY_DATE,
      legacy,
      history: previous?.history ?? [],
    };
  }
  return decisions;
}

function readDir(path: string): string[] {
  return readdirSync(path);
}

export function serializeApprovals(decisions: Record<string, Decision>): string {
  return stringify(decisions, { lineWidth: 0 });
}
