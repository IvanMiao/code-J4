import { describe, expect, it } from 'vitest';
import { compileInk } from '../tools/lib/ink.ts';
import { loadContent, STORY_ENTRY } from '../tools/lib/content.ts';
import { lintStory } from '../tools/lint-story.ts';
import { playPath, simulate } from '../tools/sim.ts';
import { speakerResolver } from '../src/engine/content.ts';
import { StoryRunner } from '../src/story/runner.ts';
import { isValidEmotion } from '../src/engine/content.ts';
import { parseCommand } from '../src/story/parse.ts';
import { validateCommand } from '../tools/lib/content.ts';

const build = compileInk(STORY_ENTRY);
const content = loadContent();

describe('story', () => {
  it('compiles, lints and simulates cleanly', async () => {
    expect(build.errors).toEqual([]);
    expect((await lintStory()).errors).toEqual([]);
    expect((await simulate()).failures).toEqual([]);
  }, 60_000);

  it('the cat only talks once it trusts you', async () => {
    const ignore = await playPath(build.json, content, 'nika_talk', null, [1]);
    expect(ignore.transcript.join('\n')).not.toContain('翻书');
    const pet = await playPath(build.json, content, 'nika_talk', null, [0]);
    expect(pet.transcript.join('\n')).toContain('翻书');
  });

  it('only offers the fish snack after buying it', async () => {
    const fresh = await playPath(build.json, content, 'nika_talk', null, []);
    expect(fresh.transcript.join('\n')).not.toContain('小鱼干');
    const bought = await playPath(build.json, content, 'kiosk', null, [0]);
    const after = await playPath(build.json, content, 'nika_talk', bought.endState, []);
    expect(after.transcript.join('\n')).toContain('小鱼干');
  });

  it('carries variables across a hot reload', () => {
    const a = new StoryRunner(build.json, speakerResolver(content.cast));
    a.story.variablesState['met_nika'] = true;
    const b = new StoryRunner(build.json, speakerResolver(content.cast));
    b.restoreVariables(a.variables());
    expect(b.story.variablesState['met_nika']).toBe(true);
  });

  it('accepts cast emotions without portrait art', () => {
    const castMember = { name: '测试', sprite: 'x', default: 'calm', emotions: ['wry'] };
    expect(isValidEmotion(castMember, 'wry')).toBe(true);
    expect(isValidEmotion(castMember, 'calm')).toBe(false);
  });

  it('@goto validates the selected map and its own anchors', () => {
    const good = parseCommand('@goto gate player_start')!;
    expect(validateCommand(good, content)).toEqual([]);
    expect(validateCommand(parseCommand('@goto unknown_map player_start')!, content)).toContain('@goto: unknown map "unknown_map"');
    expect(validateCommand(parseCommand('@goto gate lib_steps')!, content)).toContain('@goto: unknown anchor "gate:lib_steps"');
  });
});
