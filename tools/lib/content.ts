import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Cast, Item } from '../../src/engine/content.ts';
import type { Encounter } from '../../src/engine/battle.ts';
import { parseMap, type FieldMap } from '../../src/engine/map.ts';
import { facingVec, REACH, walkableFoot, type Facing } from '../../src/engine/walk.ts';
import { COMMANDS, DIRS, EMOTES, type ArgKind } from '../../src/story/commands.ts';
import type { CommandEvent } from '../../src/story/parse.ts';

export const STORY_ENTRY = 'content/story/main.ink';

export interface AudioManifest {
  bgm?: Record<string, { prompt: string; seconds: number }>;
  ambience?: Record<string, { prompt: string; seconds: number }>;
  sfx?: Record<string, { prompt: string; seconds: number }>;
}

export interface Content {
  cast: Cast;
  items: Record<string, Item>;
  encounters: Record<string, Encounter>;
  audio: AudioManifest;
  maps: Record<string, FieldMap>;
  anchors: Set<string>;
  /** Art file names (without .png) available in public/art/retro. */
  art: Set<string>;
}

const yaml = <T>(path: string): T => parse(readFileSync(path, 'utf8')) as T;

export function loadContent(root = '.'): Content {
  const mapDir = join(root, 'content/maps');
  const maps: Record<string, FieldMap> = {};
  for (const f of readdirSync(mapDir).filter((f) => f.endsWith('.tmj'))) maps[f.replace(/\.tmj$/, '')] = parseMap(readFileSync(join(mapDir, f), 'utf8'));
  return {
    cast: yaml(join(root, 'content/cast/cast.yaml')),
    items: yaml(join(root, 'content/data/items.yaml')),
    encounters: yaml(join(root, 'content/data/encounters.yaml')),
    audio: yaml(join(root, 'content/audio.yaml')),
    maps,
    anchors: new Set(Object.values(maps).flatMap((m) => Object.keys(m.anchors))),
    art: new Set(readdirSync(join(root, 'public/art/retro')).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, ''))),
  };
}

function checkArg(kind: ArgKind, value: string, cmd: string, c: Content): string | null {
  const ok = (cond: boolean, what: string) => (cond ? null : `unknown ${what} "${value}"`);
  switch (kind) {
    case 'actor': return ok(value in c.cast, 'actor');
    case 'anchor': return ok(c.anchors.has(value), 'map anchor');
    case 'actorOrAnchor': return ok(value in c.cast || c.anchors.has(value) || (DIRS as readonly string[]).includes(value), 'actor/anchor/direction');
    case 'dir': return ok((DIRS as readonly string[]).includes(value), 'direction');
    case 'emote': return ok((EMOTES as readonly string[]).includes(value), `emote (use ${EMOTES.join(' ')})`);
    case 'number': return ok(value !== '' && !isNaN(Number(value)), 'number');
    case 'inOut': return ok(value === 'in' || value === 'out', 'value (in/out)');
    case 'item': return ok(value in c.items, 'item (content/data/items.yaml)');
    case 'id': return ok(value in c.encounters, 'encounter (content/data/encounters.yaml)');
    case 'audio': {
      const bank = c.audio[cmd as keyof AudioManifest] ?? {};
      return ok(value in bank || (cmd !== 'sfx' && value === 'stop'), `${cmd} id (content/audio.yaml)`);
    }
  }
}

/** Returns human-readable problems with one `@command`. */
export function validateCommand(cmd: CommandEvent, c: Content): string[] {
  const spec = COMMANDS[cmd.name];
  if (!spec) return [`unknown command @${cmd.name} (known: ${Object.keys(COMMANDS).join(', ')})`];
  const errs: string[] = [];
  if (cmd.args.length !== spec.args.length) errs.push(`@${cmd.name} takes ${spec.args.length} argument(s) — ${spec.help}`);
  spec.args.forEach((kind, i) => {
    if (cmd.args[i] === undefined) return;
    const e = checkArg(kind, cmd.args[i], cmd.name, c);
    if (e) errs.push(`@${cmd.name}: ${e}`);
  });
  for (const [k, v] of Object.entries(cmd.options)) {
    const kind = spec.options?.[k];
    if (!kind) errs.push(`@${cmd.name}: unknown option ${k}= — ${spec.help}`);
    else {
      const e = checkArg(kind, v, cmd.name, c);
      if (e) errs.push(`@${cmd.name} ${k}=: ${e}`);
    }
  }
  if (cmd.name === 'walk' && !cmd.options.to) errs.push(`@walk needs to=<anchor>`);
  return errs;
}

/** Exits must point at an existing map and anchor. */
export function checkExits(c: Content): string[] {
  const errs: string[] = [];
  for (const [id, m] of Object.entries(c.maps)) {
    for (const e of m.exits) {
      const to = c.maps[e.map];
      if (!to) errs.push(`map ${id}: exit "${e.id}" goes to unknown map "${e.map}"`);
      else if (!to.anchors[e.anchor]) errs.push(`map ${id}: exit "${e.id}" goes to unknown anchor "${e.map}:${e.anchor}"`);
    }
    if (m.background && !c.art.has(m.background)) errs.push(`map ${id}: background "${m.background}" has no art file`);
    for (const k of ['bgm', 'ambience'] as const) {
      const v = m[k];
      if (v && !c.audio[k]?.[v]) errs.push(`map ${id}: unknown ${k} "${v}"`);
    }
  }
  return errs;
}

/** Map knots + intro: the places the game enters the story from. */
export function entryKnots(c: Content): string[] {
  const set = new Set(['intro']);
  for (const m of Object.values(c.maps)) {
    for (const a of m.actors) if (a.knot) set.add(a.knot);
    for (const t of m.triggers) set.add(t.knot);
  }
  return [...set];
}

export interface SourceLine {
  file: string;
  line: number;
  knot: string | null;
  /** Content with ink markup (choice bullets, gathers, comments) stripped. */
  text: string;
  raw: string;
}

/** Walks .ink source lines that can produce output, tracking the enclosing knot. */
export function sourceLines(files: string[]): SourceLine[] {
  const out: SourceLine[] = [];
  for (const file of files) {
    let knot: string | null = null;
    readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
      const k = /^\s*={2,}\s*([\w]+)/.exec(raw);
      if (k) return void (knot = k[1]);
      const text = raw.replace(/\/\/.*$/, '').replace(/^\s*(?:[*+-]\s*)*/, '').trim();
      if (!text || /^(?:~|VAR|CONST|INCLUDE|->|\{|\}|\[|=|else\s*:)/.test(text)) return;
      out.push({ file, line: i + 1, knot, text, raw });
    });
  }
  return out;
}

/** Every story trigger declares the side it is used from, and a player can stand there facing it. */
export function checkTriggers(c: Content): string[] {
  const errs: string[] = [];
  const faces = ['up', 'down', 'left', 'right'];
  const icons = ['talk', 'look', 'door', 'use'];
  for (const [id, m] of Object.entries(c.maps)) {
    for (const [name, anchor] of Object.entries(m.anchors))
      if (!walkableFoot(anchor, m.walkable, m.blocked)) errs.push(`map ${id}: anchor "${name}" is not footprint-walkable`);
    for (const a of m.actors)
      if (!walkableFoot(a, m.walkable, m.blocked)) errs.push(`map ${id}: actor "${a.id}" spawn is not footprint-walkable`);
    for (const t of m.triggers) {
      if (t.icon && !icons.includes(t.icon)) errs.push(`map ${id}: trigger "${t.id}" has invalid icon "${t.icon}" (use ${icons.join('|')})`);
      if (!t.face || !faces.includes(t.face)) {
        errs.push(`map ${id}: trigger "${t.id}" needs face=up|down|left|right (the direction the player faces to use it)`);
        continue;
      }
      const f = facingVec(t.face as Facing);
      let ok = false;
      for (let x = t.x; x <= t.x + t.width && !ok; x += 4)
        for (let y = t.y; y <= t.y + t.height && !ok; y += 4)
          ok = walkableFoot({ x: x - f.x * REACH, y: y - f.y * REACH }, m.walkable, m.blocked);
      if (!ok) errs.push(`map ${id}: trigger "${t.id}" cannot be reached by a player facing ${t.face}`);
    }
  }
  return errs;
}
