import { describe, expect, it } from 'vitest';
import { parseCommand, parseStoryLine } from '../src/story/parse.ts';

const speakerOf = (n: string) => ({ 林夏: 'linxia', linxia: 'linxia', 橘子: 'juzi' })[n] ?? null;

describe('parseStoryLine', () => {
  it('reads speaker, emotion, voice and line id', () => {
    expect(parseStoryLine('橘子: 别这样看着我，人类。', ['smug', 'vo', 'line:juzi_5'], speakerOf)).toEqual({
      kind: 'line', speaker: 'juzi', text: '别这样看着我，人类。', emotion: 'smug', lineId: 'juzi_5', voiced: true, tags: ['smug', 'vo', 'line:juzi_5'],
    });
  });

  it('accepts a full-width colon and treats unknown names as narration', () => {
    expect(parseStoryLine('林夏：好冷。', [], speakerOf)).toMatchObject({ speaker: 'linxia', text: '好冷。' });
    expect(parseStoryLine('注意: 小心车', [], speakerOf)).toMatchObject({ speaker: null, text: '注意: 小心车' });
  });

  it('parses commands with args and options', () => {
    expect(parseCommand('@walk linxia to=door speed=80')).toMatchObject({ name: 'walk', args: ['linxia'], options: { to: 'door', speed: '80' } });
    expect(parseStoryLine('@bgm night_street fade=2', [], speakerOf)).toMatchObject({ kind: 'command', name: 'bgm' });
  });
});
