/**
 * npm run lint:story — static checks for the ink story against cast, map, items, audio and encounters.
 * Errors fail the command; warnings are printed.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { compileInk } from './lib/ink.ts';
import { checkExits, checkTriggers, entryKnots, loadContent, sourceLines, STORY_ENTRY, validateCommand } from './lib/content.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { parseCommand, parseStoryLine } from '../src/story/parse.ts';
import { StoryRunner } from '../src/story/runner.ts';

const MAX_LINE_CHARS = 60;

export function lintStory(root = '.') {
  const errors: string[] = [];
  const warnings: string[] = [];
  const build = compileInk(`${root}/${STORY_ENTRY}`);
  errors.push(...build.errors.map((e) => `ink: ${e}`));
  warnings.push(...build.warnings.map((w) => `ink: ${w}`));
  if (build.errors.length) return { errors, warnings };

  const content = loadContent(root);
  const speakerOf = speakerResolver(content.cast);
  const knots = new StoryRunner(build.json, speakerOf).knots();
  const lineIds = new Map<string, string>();
  const sources = sourceLines(build.files);
  const at = (s: { file: string; line: number }) => `${relative(root, s.file)}:${s.line}`;

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
      if (!member.portraits[ev.emotion]) {
        errors.push(`${at(s)}  ${member.name} has no "#${ev.emotion}" portrait (has: ${Object.keys(member.portraits).join(', ')})`);
      }
    }
    if (ev.voiced && !ev.lineId) errors.push(`${at(s)}  #vo line needs a #line:<id> (run npm run story:ids)`);
    if (ev.lineId) {
      if (lineIds.has(ev.lineId)) errors.push(`${at(s)}  duplicate #line:${ev.lineId} (also ${lineIds.get(ev.lineId)})`);
      lineIds.set(ev.lineId, at(s));
    }
    if ([...ev.text].length > MAX_LINE_CHARS) warnings.push(`${at(s)}  line is ${[...ev.text].length} chars; the box fits ~${MAX_LINE_CHARS}`);
  }

  errors.push(...checkExits(content), ...checkTriggers(content));
  const entries = entryKnots(content);
  for (const k of entries) if (!knots.includes(k)) errors.push(`map/game uses knot "${k}" but it is not in the story`);
  const diverted = new Set(build.files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/->\s*(\w+)/g)].map((m) => m[1])));
  for (const k of knots) if (!entries.includes(k) && !diverted.has(k)) warnings.push(`knot "${k}" is never entered (no map object or -> divert)`);
  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = lintStory();
  for (const w of warnings) console.log(`warn  ${w}`);
  for (const e of errors) console.log(`ERROR ${e}`);
  console.log(`lint:story — ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
