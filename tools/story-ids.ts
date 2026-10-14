/**
 * npm run story:ids            add a stable #line:<knot>_<n> to every dialogue line that lacks one
 * npm run story:ids -- --check fail instead of writing (CI)
 * Voice-over files are keyed by these ids, so editing a line's text keeps its id and only that file is regenerated.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { compileInk } from './lib/ink.ts';
import { loadContent, sourceLines, STORY_ENTRY } from './lib/content.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { parseStoryLine } from '../src/story/parse.ts';

const check = process.argv.includes('--check');
const build = compileInk(STORY_ENTRY);
if (build.errors.length) {
  console.log(build.errors.join('\n'));
  process.exit(1);
}
const speakerOf = speakerResolver(loadContent().cast);
const lines = sourceLines(build.files);
const used = new Set(lines.flatMap((s) => [...s.raw.matchAll(/#\s*line:(\w+)/g)].map((m) => m[1])));
const edits = new Map<string, Map<number, string>>();
let missing = 0;

for (const s of lines) {
  if (/#\s*line:/.test(s.raw)) continue;
  const [body, ...tags] = s.text.split('#');
  const ev = parseStoryLine(body, tags, speakerOf);
  if (ev?.kind !== 'line' || !ev.speaker) continue;
  missing++;
  if (check) {
    console.log(`${relative('.', s.file)}:${s.line} has no #line id`);
    continue;
  }
  const base = s.knot ?? 'line';
  let n = 1;
  while (used.has(`${base}_${n}`)) n++;
  used.add(`${base}_${n}`);
  if (!edits.has(s.file)) edits.set(s.file, new Map());
  edits.get(s.file)!.set(s.line, `${s.raw.replace(/\s+$/, '')} #line:${base}_${n}`);
}

for (const [file, byLine] of edits) {
  const src = readFileSync(file, 'utf8').split('\n');
  for (const [ln, text] of byLine) src[ln - 1] = text;
  writeFileSync(file, src.join('\n'));
}
console.log(check ? `story:ids — ${missing} line(s) without id` : `story:ids — added ${missing} id(s)`);
process.exit(check && missing ? 1 : 0);
