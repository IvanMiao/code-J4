/**
 * Generates music, ambience, sound effects and key-line voice-over with ElevenLabs (dev-time only).
 *
 *   npm run gen:audio                 generate anything new or changed (cached by request hash)
 *   npm run gen:audio -- --only vo    one kind: bgm | ambience | sfx | vo
 *   npm run gen:audio -- --id juzi_5 --force
 *   npm run gen:audio -- --dry        list jobs and the voice-over character count, call nothing
 *
 * Inputs: content/audio.yaml (bgm/ambience/sfx prompts) and every story line tagged #vo #line:<id>
 * (voice + emotion tag from content/cast/cast.yaml). Output: public/audio/<kind>/<id>.mp3 + public/audio/index.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { compileInk } from './lib/ink.ts';
import { loadContent, sourceLines, STORY_ENTRY } from './lib/content.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { parseStoryLine } from '../src/story/parse.ts';

const API = 'https://api.elevenlabs.io';
const FORMAT = 'mp3_44100_128';
const PROVENANCE = 'assets/audio-provenance.json';
const OUT = 'public/audio';

type Kind = 'bgm' | 'ambience' | 'sfx' | 'vo';
interface Job { kind: Kind; id: string; path: string; body: Record<string, unknown>; label: string }

const argv = process.argv.slice(2);
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const flag = (n: string) => argv.includes(`--${n}`);

function jobs(): Job[] {
  const c = loadContent();
  const out: Job[] = [];
  for (const [id, a] of Object.entries(c.audio.bgm ?? {})) {
    out.push({ kind: 'bgm', id, path: `/v1/music?output_format=${FORMAT}`, label: a.prompt, body: { prompt: a.prompt, music_length_ms: a.seconds * 1000 } });
  }
  for (const kind of ['ambience', 'sfx'] as const) {
    for (const [id, a] of Object.entries(c.audio[kind] ?? {})) {
      out.push({
        kind, id, path: `/v1/sound-generation?output_format=${FORMAT}`, label: a.prompt,
        body: { text: a.prompt, duration_seconds: a.seconds, prompt_influence: 0.5, ...(kind === 'ambience' ? { loop: true } : {}) },
      });
    }
  }
  const build = compileInk(STORY_ENTRY);
  if (build.errors.length) throw new Error(build.errors.join('\n'));
  const speakerOf = speakerResolver(c.cast);
  for (const s of sourceLines(build.files)) {
    const [body, ...tags] = s.text.split('#');
    const ev = parseStoryLine(body, tags, speakerOf);
    if (ev?.kind !== 'line' || !ev.voiced || !ev.lineId || !ev.speaker) continue;
    const member = c.cast[ev.speaker];
    if (!member.voice?.id) throw new Error(`${member.name} has no voice.id in cast.yaml (line ${ev.lineId})`);
    const tag = member.voice.tags?.[ev.emotion ?? member.default] ?? '';
    const text = `${tag} ${ev.text}`.trim();
    out.push({
      kind: 'vo', id: ev.lineId, label: `${member.name}: ${text}`,
      path: `/v1/text-to-speech/${member.voice.id}?output_format=${FORMAT}`,
      body: { text, model_id: 'eleven_v3', language_code: 'zh' },
    });
  }
  return out;
}

async function call(job: Job): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API + job.path, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(job.body) });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = await res.text();
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(`${job.kind}/${job.id}: HTTP ${res.status} ${detail.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

const hash = (j: Job) => createHash('sha256').update(JSON.stringify([j.path, j.body])).digest('hex').slice(0, 16);
const file = (j: Job) => `${OUT}/${j.kind}/${j.id}.mp3`;

async function main() {
  const prov: Record<string, { hash: string; generatedAt: string; request: string }> = existsSync(PROVENANCE) ? JSON.parse(readFileSync(PROVENANCE, 'utf8')) : {};
  let all = jobs();
  const only = opt('only'), id = opt('id');
  const todo = all.filter((j) => (!only || j.kind === only) && (!id || j.id === id) && (flag('force') || prov[`${j.kind}/${j.id}`]?.hash !== hash(j) || !existsSync(file(j))));
  if (flag('dry')) {
    for (const j of todo) console.log(`${j.kind}/${j.id}  ${j.label}`);
    const chars = todo.filter((j) => j.kind === 'vo').reduce((n, j) => n + String(j.body.text).length, 0);
    console.log(`${todo.length} job(s), ${chars} voice-over characters`);
    return;
  }
  const failures: string[] = [];
  const queue = [...todo];
  const worker = async () => {
    for (let j = queue.shift(); j; j = queue.shift()) {
      try {
        console.log(`[gen] ${j.kind}/${j.id}`);
        const audio = await call(j);
        mkdirSync(dirname(file(j)), { recursive: true });
        writeFileSync(file(j), audio);
        prov[`${j.kind}/${j.id}`] = { hash: hash(j), generatedAt: new Date().toISOString(), request: j.label };
      } catch (e) {
        failures.push((e as Error).message);
      }
    }
  };
  await Promise.all(Array.from({ length: Number(opt('concurrency') ?? 3) }, worker));
  writeFileSync(PROVENANCE, JSON.stringify(prov, null, 2) + '\n');
  all = all.filter((j) => existsSync(file(j)));
  const index: Record<string, Record<string, string>> = {};
  for (const j of all) (index[j.kind] ??= {})[j.id] = `${j.kind}/${j.id}.mp3`;
  writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2) + '\n');
  console.log(`gen:audio — ${todo.length - failures.length}/${todo.length} generated, index has ${all.length} file(s)`);
  for (const f of failures) console.log(`FAILED ${f}`);
  if (failures.length) process.exit(1);
}

main();
