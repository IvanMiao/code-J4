import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/engine/map.ts';
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

describe('parseMap image layers', () => {
  it('parses image layer offsets, parallax, planes, and paper grain', () => {
    const map = JSON.stringify({
      width: 384, height: 54, tilewidth: 10, tileheight: 10,
      properties: [{ name: 'paperGrain', type: 'float', value: 0.35 }],
      layers: [
        {
          id: 4, type: 'imagelayer', name: 'far', image: 'bg_water_street_far',
          offsetx: 17, offsety: -3, parallaxx: 0.35, parallaxy: 1,
          properties: [{ name: 'plane', type: 'string', value: 'back' }],
        },
        {
          id: 5, type: 'imagelayer', name: 'foreground', image: 'bg_water_street_front',
          properties: [{ name: 'plane', type: 'string', value: 'front' }],
        },
      ],
    });

    expect(parseMap(map)).toMatchObject({
      paperGrain: 0.35,
      layers: [
        { id: '4', image: 'bg_water_street_far', x: 17, y: -3, parallaxX: 0.35, parallaxY: 1, plane: 'back' },
        { id: '5', image: 'bg_water_street_front', x: 0, y: 0, parallaxX: 1, parallaxY: 1, plane: 'front' },
      ],
    });
  });

  it('defaults maps without image layers to no layers and no paper grain', () => {
    expect(parseMap({ width: 10, height: 8, tilewidth: 24, tileheight: 24, layers: [] }))
      .toMatchObject({ layers: [], paperGrain: 0 });
  });
});
