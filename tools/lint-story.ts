/**
 * npm run lint:story — static checks for the ink story against cast, map, items, audio and encounters.
 * Errors fail the command; warnings are printed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { compileInk } from './lib/ink.ts';
import { checkExits, checkTriggers, entryKnots, loadContent, sourceLines, STORY_ENTRY, validateCommand } from './lib/content.ts';
import { frameInsetErrors, paintedScalePass, renderedAlphaHeight, scaleAtFeet, type SpriteMetrics } from './lib/scene-fit.ts';
import { isValidEmotion, speakerResolver } from '../src/engine/content.ts';
import { parseCommand, parseStoryLine } from '../src/story/parse.ts';
import { StoryRunner } from '../src/story/runner.ts';
import { plainText } from '../src/engine/handwriting.ts';
import OpenCC from 'opencc-js';

const MAX_LINE_CHARS = 60;
const toTraditional = OpenCC.Converter({ from: 'cn', to: 't' });

async function measureSprite(root: string, path: string): Promise<SpriteMetrics> {
  const { data, info } = await sharp(join(root, path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cols = 3, rows = 2, frameWidth = Math.floor(info.width / cols), frameHeight = Math.floor(info.height / rows);
  let alphaWidth = 0, alphaHeight = 0;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let minX = frameWidth, minY = frameHeight, maxX = -1, maxY = -1;
    for (let y = 0; y < frameHeight; y++) for (let x = 0; x < frameWidth; x++) {
      const i = ((row * frameHeight + y) * info.width + col * frameWidth + x) * info.channels + info.channels - 1;
      if (data[i] > 8) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    if (maxX >= 0) {
      alphaWidth = Math.max(alphaWidth, maxX - minX + 1);
      alphaHeight = Math.max(alphaHeight, maxY - minY + 1);
    }
  }
  return { frameWidth, frameHeight, alphaWidth, alphaHeight };
}

export async function lintStory(root = '.') {
  const errors: string[] = [];
  const warnings: string[] = [];
  const build = compileInk(`${root}/${STORY_ENTRY}`);
  errors.push(...build.errors.map((e) => `ink: ${e}`));
  warnings.push(...build.warnings.map((w) => `ink: ${w}`));
  if (build.errors.length) return { errors, warnings };

  const content = loadContent(root);
  const charsetPath = join(root, 'public/fonts/hands/charset.txt');
  try {
    const charset = new Set(readFileSync(charsetPath, 'utf8'));
    const storyChars = new Set(readdirSync(join(root, 'content/story'))
      .filter((file) => file.endsWith('.ink'))
      .flatMap((file) => [...readFileSync(join(root, 'content/story', file), 'utf8')]));
    const missing = [...storyChars].filter((ch) => !charset.has(ch)).sort();
    if (missing.length) warnings.push(`story characters missing from charset.txt: ${missing.join('')} (run npm run fonts)`);
  } catch {
    warnings.push('handwriting charset.txt is missing (run npm run fonts)');
  }
  const speakerOf = speakerResolver(content.cast);
  const knots = new StoryRunner(build.json, speakerOf).knots();
  const lineIds = new Map<string, string>();
  const sources = sourceLines(build.files);
  const at = (s: { file: string; line: number }) => `${relative(root, s.file)}:${s.line}`;
  const scriptByFile = new Map(build.files.map((file) => [
    file,
    readFileSync(file, 'utf8').split(/\r?\n/, 1)[0] === '// script: hant' ? 'hant' : 'hans',
  ]));
  for (const s of sources) {
    if (scriptByFile.get(s.file) !== 'hant') continue;
    const offending = [...new Set([...s.text].filter((ch) => toTraditional(ch) !== ch))];
    if (offending.length) errors.push(`${at(s)}  hant text contains simplified characters: ${offending.join('')}`);
    const quoteMarks = [...new Set([...s.text].filter((ch) => '“”‘’'.includes(ch)))];
    if (quoteMarks.length) errors.push(`${at(s)}  hant text uses non-Traditional quotation marks: ${quoteMarks.join('')}`);
  }

  for (const s of sources) {
    const [body, ...tagParts] = s.text.split('#');
    const tags = tagParts.map((t) => t.trim()).filter(Boolean);
    const cmd = parseCommand(body);
    if (cmd) {
      for (const e of validateCommand(cmd, content)) errors.push(`${at(s)}  ${e}`);
      continue;
    }
    const ev = parseStoryLine(body, tags, speakerOf);
    if (!ev || ev.kind !== 'line') continue;
    const maybeSpeaker = /^([^\s:：]{1,8})\s*[:：]/.exec(body.trim());
    if (!ev.speaker && maybeSpeaker && !/[，。！？]/.test(maybeSpeaker[1])) {
      warnings.push(`${at(s)}  "${maybeSpeaker[1]}" looks like a speaker but is not in content/cast/cast.yaml`);
    }
    if (ev.speaker && ev.emotion) {
      const member = content.cast[ev.speaker];
      if (!isValidEmotion(member, ev.emotion)) {
        errors.push(`${at(s)}  ${member.name} has no "#${ev.emotion}" emotion (has: ${[...Object.keys(member.portraits ?? {}), ...(member.emotions ?? [])].join(', ')})`);
      }
    }
    if (ev.voiced && !ev.lineId) errors.push(`${at(s)}  #vo line needs a #line:<id> (run npm run story:ids)`);
    if (ev.lineId) {
      if (lineIds.has(ev.lineId)) errors.push(`${at(s)}  duplicate #line:${ev.lineId} (also ${lineIds.get(ev.lineId)})`);
      lineIds.set(ev.lineId, at(s));
    }
    const length = [...plainText(ev.text)].length;
    if (length > MAX_LINE_CHARS) warnings.push(`${at(s)}  line is ${length} chars; the box fits ~${MAX_LINE_CHARS}`);
  }

  errors.push(...checkExits(content), ...checkTriggers(content));
  for (const [mapId, map] of Object.entries(content.maps)) {
    if (!map.frameInset) continue;
    const player = content.cast[map.player];
    if (!player?.sprite) continue;
    const metrics = await measureSprite(root, `public/art/${player.art ?? map.art ?? 'retro'}/${player.sprite}.png`);
    errors.push(...frameInsetErrors(map, metrics, player.height ?? 110).map((e) => `map ${mapId}: ${e}`));
  }
  const scenePath = join(root, 'assets/scenes/ming_scriptorium.yaml');
  if (content.maps.ming_scriptorium) {
    const scene = JSON.parse(readFileSync(scenePath, 'utf8')) as {
      figures: Record<string, { height_art: number; feet_art: [number, number] }>;
    };
    const map = content.maps.ming_scriptorium;
    for (const [id, figure] of Object.entries(scene.figures)) {
      const member = content.cast[id];
      if (!member?.sprite) continue;
      const metrics = await measureSprite(root, `public/art/${member.art ?? map.art ?? 'retro'}/${member.sprite}.png`);
      const rendered = renderedAlphaHeight(metrics, member.height ?? 110, scaleAtFeet(map, figure.feet_art[1]));
      if (!paintedScalePass(rendered, figure.height_art))
        errors.push(`map ming_scriptorium: ${id} rendered height ${rendered.toFixed(1)}px differs from painted ${figure.height_art}px by more than 5%`);
    }
  }
  const knotScripts = new Map<string, 'hans' | 'hant'>();
  for (const file of build.files) {
    const script = scriptByFile.get(file) === 'hant' ? 'hant' : 'hans';
    for (const [, knot] of readFileSync(file, 'utf8').matchAll(/^={2,}\s*([\w-]+)/gm)) knotScripts.set(knot, script);
  }
  for (const [mapId, map] of Object.entries(content.maps)) {
    if (map.script !== 'hant') continue;
    const used = [map.intro, ...map.actors.map((actor) => actor.knot), ...map.triggers.map((trigger) => trigger.knot)].filter(Boolean) as string[];
    for (const knot of used) if (knotScripts.get(knot) !== 'hant') errors.push(`map ${mapId}: hant knot "${knot}" must be defined in a hant story file`);
  }
  const entries = entryKnots(content);
  for (const k of entries) if (!knots.includes(k)) errors.push(`map/game uses knot "${k}" but it is not in the story`);
  const diverted = new Set(build.files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/->\s*(\w+)/g)].map((m) => m[1])));
  for (const k of knots) if (!entries.includes(k) && !diverted.has(k)) warnings.push(`knot "${k}" is never entered (no map object or -> divert)`);
  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = await lintStory();
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`lint:story — ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
