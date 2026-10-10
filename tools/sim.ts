/**
 * npm run sim — plays every entry knot headlessly through every choice and @battle outcome,
 * from a fresh state and from the state after each other entry knot. Fails on ink runtime
 * errors/warnings, invalid commands, missing portraits or runaway loops.
 *
 *   npm run sim                         explore everything
 *   npm run sim -- --print nika_talk    print one playthrough (first option everywhere)
 *   npm run sim -- --print nika_talk --pick 1,0   choose option 2 at the first decision, 1 at the second
 */
import { compileInk } from './lib/ink.ts';
import { entryKnots, loadContent, STORY_ENTRY, validateCommand, type Content } from './lib/content.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { COMMANDS } from '../src/story/commands.ts';
import { StoryRunner } from '../src/story/runner.ts';

const MAX_EVENTS = 2000;
const MAX_PATHS_PER_RUN = 400;

export interface PathResult { points: number[]; transcript: string[]; errors: string[]; endState: string }

export async function playPath(json: string, content: Content, knot: string, startState: string | null, picks: number[]): Promise<PathResult> {
  const cast = content.cast;
  const runner = new StoryRunner(json, speakerResolver(cast));
  if (startState) runner.loadState(startState);
  const errors: string[] = [];
  const transcript: string[] = [];
  const points: number[] = [];
  let events = 0;
  const decide = (n: number) => {
    const pick = picks[points.length] ?? 0;
    points.push(n);
    return pick;
  };
  const tick = () => {
    if (++events > MAX_EVENTS) throw new Error(`more than ${MAX_EVENTS} events — infinite loop?`);
  };
  (runner.story as any).onError = (msg: string) => errors.push(`ink: ${msg}`);
  try {
    await runner.play(knot, {
      async line(e) {
        tick();
        const m = e.speaker ? cast[e.speaker] : null;
        if (m && e.emotion && !m.portraits[e.emotion]) errors.push(`${m.name} has no #${e.emotion} portrait: "${e.text}"`);
        transcript.push(`${m ? m.name + '：' : ''}${e.text}${e.emotion ? `  #${e.emotion}` : ''}`);
      },
      async command(c) {
        tick();
        errors.push(...validateCommand(c, content));
        const outcomes = COMMANDS[c.name]?.outcomes;
        if (!outcomes) return void transcript.push(`  ${c.raw}`);
        const v = outcomes.values[decide(outcomes.values.length)];
        transcript.push(`  ${c.raw}  → ${v}`);
        return v;
      },
      async choose(options) {
        tick();
        const i = decide(options.length);
        transcript.push(...options.map((o, j) => `  ${j === i ? '▶' : ' '} ${j + 1}. ${o}`));
        return i;
      },
    });
  } catch (e) {
    errors.push((e as Error).message);
  }
  return { points, transcript, errors, endState: runner.saveState() };
}

/** Depth-first over every decision combination for one knot from one start state. */
export async function explore(json: string, content: Content, knot: string, startState: string | null) {
  const stack: number[][] = [[]];
  const failures: { picks: number[]; errors: string[] }[] = [];
  let paths = 0;
  while (stack.length && paths < MAX_PATHS_PER_RUN) {
    const picks = stack.pop()!;
    const r = await playPath(json, content, knot, startState, picks);
    paths++;
    if (r.errors.length) failures.push({ picks, errors: r.errors });
    for (let i = picks.length; i < r.points.length; i++) {
      const prefix = r.points.slice(0, i).map((_, j) => picks[j] ?? 0);
      for (let alt = 1; alt < r.points[i]; alt++) stack.push([...prefix, alt]);
    }
  }
  return { paths, failures };
}

export async function simulate(root = '.') {
  const build = compileInk(`${root}/${STORY_ENTRY}`);
  if (build.errors.length) return { paths: 0, failures: build.errors.map((e) => ({ knot: '(compile)', state: '', picks: [], errors: [e] })) };
  const content = loadContent(root);
  const entries = entryKnots(content);
  const starts: { label: string; state: string | null }[] = [{ label: 'fresh', state: null }];
  for (const k of entries) starts.push({ label: `after ${k}`, state: (await playPath(build.json, content, k, null, [])).endState });
  let paths = 0;
  const failures: { knot: string; state: string; picks: number[]; errors: string[] }[] = [];
  for (const s of starts) {
    for (const k of entries) {
      const r = await explore(build.json, content, k, s.state);
      paths += r.paths;
      failures.push(...r.failures.map((f) => ({ knot: k, state: s.label, ...f })));
    }
  }
  return { paths, failures, entries: entries.length, starts: starts.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n: string) => {
    const i = process.argv.indexOf(`--${n}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const print = arg('print');
  if (print) {
    const build = compileInk(STORY_ENTRY);
    const picks = (arg('pick') ?? '').split(',').filter(Boolean).map(Number);
    const r = await playPath(build.json, loadContent(), print, null, picks);
    console.log(r.transcript.join('\n'));
    for (const e of r.errors) console.log(`ERROR ${e}`);
    process.exit(r.errors.length ? 1 : 0);
  }
  const r = await simulate();
  const seen = new Set<string>();
  for (const f of r.failures) {
    for (const e of f.errors) {
      const key = `${f.knot}|${e}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`ERROR ${f.knot} (${f.state}, picks ${f.picks.join(',') || '-'}): ${e}`);
    }
  }
  console.log(`sim — ${r.paths} playthroughs over ${r.entries} entry knots × ${r.starts} start states, ${seen.size} problem(s)`);
  process.exit(seen.size ? 1 : 0);
}
