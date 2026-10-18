/**
 * Offline art generation. Reads assets/manifest/*.yaml, calls Gemini (Nano Banana) for
 * each item, keeps the raw output in assets/raw/ and writes the post-processed file to `out`.
 *
 *   npm run gen:art                       # everything missing or changed
 *   npm run gen:art -- --id retro/bg_gate --force
 *   npm run gen:art -- --style hd --post-only   # re-run post-processing from raw only
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { generateImage } from './lib/gemini.ts';
import { runPost, stackRows, type PostStep } from './lib/image.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const Item = z.object({
  id: z.string(),
  model: z.string().default('gemini-3.1-flash-image'),
  aspect: z.string().default('1:1'),
  size: z.enum(['1K', '2K', '4K']).optional(),
  prompt: z.string().default(''),
  /** Build-only item: stacks other items' outputs as rows (e.g. walk strips into one sheet). No API call. */
  compose: z.array(z.object({ from: z.string(), mirror: z.boolean().default(false) })).optional(),
  refs: z.array(z.string()).default([]),
  /** Fixed, judged input image; this item is post-processed but never regenerated. */
  raw: z.string().optional(),
  post: z.array(z.any()).default([]),
  out: z.string(),
});
const Manifest = z.object({ style: z.string(), bible: z.string(), items: z.array(Item) });
type Item = z.infer<typeof Item>;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const manifests = readdirSync(join(ROOT, 'assets/manifest'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => Manifest.parse(parse(readFileSync(join(ROOT, 'assets/manifest', f), 'utf8'))));

const items = new Map<string, { item: Item; bible: string }>();
for (const m of manifests) {
  const bible = readFileSync(join(ROOT, m.bible), 'utf8');
  for (const item of m.items) items.set(item.id, { item, bible });
}

const ledgerPath = join(ROOT, 'assets/provenance.json');
const ledger: Record<string, { model: string; promptHash: string; refs: string[]; generatedAt: string }> = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
  : {};

const rawPath = (id: string) => join(ROOT, 'assets/raw', `${id}.png`);
const fullPrompt = (item: Item, bible: string) => `${bible.trim()}\n\n---\nASSET: ${item.id}\n${item.prompt.trim()}`;
const hashOf = (item: Item, bible: string) =>
  createHash('sha256').update(JSON.stringify([item.model, item.aspect, item.size, fullPrompt(item, bible), item.refs])).digest('hex').slice(0, 16);

const done = new Map<string, Promise<void>>();
function build(id: string): Promise<void> {
  if (!done.has(id)) done.set(id, buildOnce(id));
  return done.get(id)!;
}

async function buildOnce(id: string): Promise<void> {
  const entry = items.get(id);
  if (!entry) throw new Error(`Unknown art id "${id}"`);
  const { item, bible } = entry;
  if (item.compose) {
    await Promise.all(item.compose.map((r) => build(r.from)));
    const rows = item.compose.map((r) => {
      const src = items.get(r.from);
      if (!src) throw new Error(`${id}: unknown compose source "${r.from}"`);
      return { png: readFileSync(join(ROOT, src.item.out)), mirror: r.mirror };
    });
    const out = join(ROOT, item.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await stackRows(rows));
    console.log(`[compose] ${id} -> ${item.out}`);
    return;
  }
  await Promise.all(item.refs.filter((r) => items.has(r)).map(build));
  const hash = hashOf(item, bible);
  const raw = item.raw ? join(ROOT, item.raw) : rawPath(id);
  const stale = !existsSync(raw) || ledger[id]?.promptHash !== hash;
  const targeted = !opt('id') || opt('id') === id;
  if (!item.raw && !flag('post-only') && targeted && (flag('force') || stale)) {
    const refs = item.refs.map((r) => ({
      mimeType: 'image/png',
      data: readFileSync(items.has(r) ? rawPath(r) : join(ROOT, r)),
    }));
    console.log(`[gen] ${id} (${item.model}, ${refs.length} ref)`);
    const png = await generateImage({ model: item.model, prompt: fullPrompt(item, bible), refs, aspectRatio: item.aspect, imageSize: item.size });
    mkdirSync(dirname(raw), { recursive: true });
    writeFileSync(raw, png);
    ledger[id] = { model: item.model, promptHash: hash, refs: item.refs, generatedAt: new Date().toISOString() };
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  }
  if (!existsSync(raw)) return;
  const out = join(ROOT, item.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await runPost(readFileSync(raw), item.post as PostStep[]));
  console.log(`[post] ${id} -> ${item.out}`);
}

const ids = opt('id') ? [opt('id')!] : [...items.keys()].filter((id) => !opt('style') || id.startsWith(`${opt('style')}/`));
const queue = [...ids];
const workers = Array.from({ length: Number(opt('concurrency') ?? 4) }, async () => {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      await build(id);
    } catch (e) {
      console.error(`[fail] ${id}: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
});
await Promise.all(workers);

const gallery = [...items.values()].map(({ item }) => ({ id: item.id, out: item.out.replace(/^public\//, ''), prompt: item.prompt.trim(), model: item.model, refs: item.refs }));
writeFileSync(join(ROOT, 'public/art/gallery.json'), JSON.stringify(gallery, null, 2) + '\n');
