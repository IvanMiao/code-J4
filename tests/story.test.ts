import { describe, expect, it } from 'vitest';
import { compileInk } from '../tools/lib/ink.ts';
import { loadContent, STORY_ENTRY } from '../tools/lib/content.ts';
import { lintStory } from '../tools/lint-story.ts';
import { playPath, simulate } from '../tools/sim.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { StoryRunner } from '../src/story/runner.ts';

const build = compileInk(STORY_ENTRY);
const content = loadContent();

describe('story', () => {
  it('compiles, lints and simulates cleanly', async () => {
    expect(build.errors).toEqual([]);
    expect(lintStory().errors).toEqual([]);
    expect((await simulate()).failures).toEqual([]);
  });

  it('writes the @battle outcome back into ink', async () => {
    const lose = await playPath(build.json, content, 'juzi_talk', null, [0, 1]);
    expect(lose.transcript.join('\n')).toContain('下次跑快点');
    const win = await playPath(build.json, content, 'juzi_talk', null, [0, 0]);
    expect(win.transcript.join('\n')).toContain('比我想的有用一点');
  });

  it('only offers the oden choice after buying it', async () => {
    const fresh = await playPath(build.json, content, 'juzi_talk', null, []);
    expect(fresh.transcript.join('\n')).not.toContain('萝卜');
    const bought = await playPath(build.json, content, 'store_door', null, []);
    const after = await playPath(build.json, content, 'juzi_talk', bought.endState, []);
    expect(after.transcript.join('\n')).toContain('萝卜');
  });

  it('carries variables across a hot reload', () => {
    const a = new StoryRunner(build.json, speakerResolver(content.cast));
    a.story.variablesState['met_juzi'] = true;
    const b = new StoryRunner(build.json, speakerResolver(content.cast));
    b.restoreVariables(a.variables());
    expect(b.story.variablesState['met_juzi']).toBe(true);
  });
});
