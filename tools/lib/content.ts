import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Cast, Item } from '../../src/engine/content.ts';
import type { Encounter } from '../../src/engine/battle.ts';
import { parseMap, type FieldMap } from '../../src/engine/map.ts';
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
