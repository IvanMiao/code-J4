import { describe, expect, it } from 'vitest';
import { armExits, exitCanBeUsed, exitEdge, parseMap, pickExit } from '../src/engine/map.ts';
import { facingOf, sideFacing, step, walkable, walkableFoot } from '../src/engine/walk.ts';
import { addItem, readSave, writeSave } from '../src/engine/save.ts';
import { createBattle, outcome, playRound } from '../src/engine/battle.ts';
import { PoseCycle } from '../src/engine/pose.ts';
import { frameInsetErrors, paintedScalePass, renderedAlphaHeight } from '../tools/lib/scene-fit.ts';
import { readFileSync } from 'node:fs';

const square = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]];

describe('walk', () => {
  it('stays inside the walkable area and slides along edges', () => {
    expect(walkable({ x: 50, y: 50 }, square)).toBe(true);
    expect(step({ x: 80, y: 50 }, { x: 10, y: 10 }, square)).toEqual({ x: 80, y: 60 });
    expect(step({ x: 85, y: 90 }, { x: 10, y: 10 }, square)).toEqual({ x: 85, y: 90 });
  });
  it('requires the whole footprint to fit and slides it along an edge', () => {
    expect(walkableFoot({ x: 10, y: 50 }, square)).toBe(false);
    expect(walkableFoot({ x: 20, y: 50 }, square)).toBe(true);
    expect(step({ x: 80, y: 50 }, { x: 10, y: 10 }, square)).toEqual({ x: 80, y: 60 });
  });
  it('picks the dominant facing', () => {
    expect(facingOf(1, 0.2, 'down')).toBe('right');
    expect(facingOf(0, -1, 'down')).toBe('up');
    expect(facingOf(0, 0, 'left')).toBe('left');
  });
  it('keeps side-view facing horizontal', () => {
    expect(sideFacing(-1, 'right')).toBe('left');
    expect(sideFacing(1, 'left')).toBe('right');
    expect(sideFacing(0, 'left')).toBe('left');
    expect(sideFacing(0, 'up')).toBe('right');
    expect(sideFacing(0, 'down')).toBe('right');
  });
});

describe('map properties', () => {
  it('defaults legacy maps to top-view campus settings', () => {
    const legacy = readFileSync(new URL('../content/maps/gate.tmj', import.meta.url), 'utf8');
    expect(parseMap(legacy)).toMatchObject({
      art: null, view: 'top', script: 'hans', player: 'linxia', dialogue: 'box', intro: null, scaleFar: 1, scaleNear: 1, paintedTitle: false, ground: 'stone',
    });
  });

  it('parses every optional property from a map fixture', () => {
    const fixture = {
      width: 10, height: 8, tilewidth: 24, tileheight: 24, layers: [],
      properties: [
        { name: 'art', value: 'ming' },
        { name: 'view', value: 'side' },
        { name: 'player', value: 'shen' },
        { name: 'dialogue', value: 'bubble' },
        { name: 'script', value: 'hant' },
        { name: 'intro', value: 'ming_intro' },
        { name: 'scaleFar', value: '0.8' },
        { name: 'scaleNear', value: '1.25' },
        { name: 'paintedTitle', value: true },
        { name: 'ground', value: 'wood' },
      ],
    };
    expect(parseMap(fixture)).toMatchObject({
      art: 'ming', view: 'side', script: 'hant', player: 'shen', dialogue: 'bubble', intro: 'ming_intro', scaleFar: 0.8, scaleNear: 1.25, paintedTitle: true, ground: 'wood',
    });
  });

  it('parses an explicit actor render depth', () => {
    const fixture = {
      width: 10, height: 8, tilewidth: 24, tileheight: 24,
      layers: [{
        type: 'objectgroup', name: 'actors',
        objects: [{
          id: 1, name: 'linu', x: 12, y: 34, point: true,
          properties: [{ name: 'depth', value: '467' }],
        }],
      }],
    };
    expect(parseMap(fixture).actors).toEqual([
      { id: 'linu', x: 12, y: 34, knot: null, face: 'down', depth: 467 },
    ]);
  });

  it('binds an interaction trigger to its pose actor', () => {
    const fixture = {
      width: 10, height: 8, tilewidth: 24, tileheight: 24,
      layers: [{
        type: 'objectgroup', name: 'triggers',
        objects: [{
          id: 1, name: 'monk', x: 4, y: 6, width: 10, height: 8,
          properties: [
            { name: 'knot', value: 'ming_monk_left' },
            { name: 'actor', value: 'monk_left' },
          ],
        }],
      }],
    };
    expect(parseMap(fixture).triggers[0]).toMatchObject({ knot: 'ming_monk_left', actor: 'monk_left' });
  });
});

describe('exit facing', () => {
  it('requires the declared facing and allows face-less exits in any direction', () => {
    expect(exitCanBeUsed({ face: 'up' }, 'up')).toBe(true);
    expect(exitCanBeUsed({ face: 'up' }, 'down')).toBe(false);
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(exitCanBeUsed({ face: null }, facing)).toBe(true);
    }
  });
});

describe('map exits', () => {
  const exit = { id: 'door', x: 0, y: 0, width: 10, height: 10, map: 'next', anchor: 'start', face: null };

  it('detects each edge and uses the door-facing direction away from edges', () => {
    expect(exitEdge({ x: 0, y: 30, width: 10, height: 20, face: 'down' }, 100, 100)).toBe('left');
    expect(exitEdge({ x: 90, y: 30, width: 10, height: 20, face: 'up' }, 100, 100)).toBe('right');
    expect(exitEdge({ x: 30, y: 0, width: 20, height: 10, face: 'down' }, 100, 100)).toBe('up');
    expect(exitEdge({ x: 30, y: 90, width: 20, height: 10, face: 'left' }, 100, 100)).toBe('down');
    expect(exitEdge({ x: 30, y: 30, width: 20, height: 20, face: 'right' }, 100, 100)).toBe('right');
  });

  it('disarms exits containing the arrival position until the player leaves, then fires on re-entry', () => {
    const inside = { x: 5, y: 5 };
    let armed = armExits([exit], inside, new Set());
    expect(armed.has(exit.id)).toBe(false);
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      expect(pickExit([exit], inside, facing, armed)).toBeUndefined();
    }
    armed = armExits([exit], { x: 6, y: 5 }, armed);
    expect(pickExit([exit], inside, 'up', armed)).toBeUndefined();

    armed = armExits([exit], { x: 15, y: 5 }, armed);
    expect(armed.has(exit.id)).toBe(true);
    armed = armExits([exit], inside, armed);
    expect(pickExit([exit], inside, 'left', armed)).toEqual(exit);
  });

  it('requires the matching facing for explicit exits and lets face-less edge exits fire while walking left', () => {
    const faced = { ...exit, face: 'up' as const };
    const armedFaced = armExits([faced], { x: 15, y: 5 }, new Set());
    expect(pickExit([faced], { x: 5, y: 5 }, 'left', armedFaced)).toBeUndefined();
    expect(pickExit([faced], { x: 5, y: 5 }, 'up', armedFaced)).toEqual(faced);

    const armedEdge = armExits([exit], { x: 15, y: 5 }, new Set());
    expect(pickExit([exit], { x: 5, y: 5 }, 'left', armedEdge)).toEqual(exit);
  });
});

describe('seated pose cycle', () => {
  it('waits 2.5–4 seconds before a one-second pose', () => {
    const cycle = new PoseCycle(() => 0.5);
    expect(cycle.update(3249)).toBe(0);
    expect(cycle.update(1)).toBe(1);
    expect(cycle.update(999)).toBe(1);
    expect(cycle.update(1)).toBe(0);
  });

  it('holds the changed pose while engaged and resumes from idle afterward', () => {
    const cycle = new PoseCycle(() => 0);
    cycle.setEngaged(true);
    expect(cycle.update(8000)).toBe(1);
    cycle.setEngaged(false);
    expect(cycle.update(0)).toBe(0);
    expect(cycle.update(2499)).toBe(0);
    expect(cycle.update(1)).toBe(1);
  });
});

describe('painted scene fit', () => {
  const metrics = { frameWidth: 100, frameHeight: 100, alphaWidth: 40, alphaHeight: 90 };
  const fixture = {
    width: 200, height: 140, frameInset: 10, scaleFar: 1, scaleNear: 1,
    walkable: [[{ x: 30, y: 105 }, { x: 170, y: 105 }, { x: 170, y: 120 }, { x: 30, y: 120 }]],
  };

  it('accepts an inset walkable polygon and rejects one that crosses the frame', () => {
    expect(frameInsetErrors(fixture, metrics, 90)).toEqual([]);
    expect(frameInsetErrors({ ...fixture, walkable: [[{ x: 25, y: 105 }, ...fixture.walkable[0].slice(1)]] }, metrics, 90).length).toBeGreaterThan(0);
  });

  it('checks page-frame fit at reachable side-view foot positions', () => {
    const sideFixture = {
      width: 100, height: 200, frameInset: 10, scaleFar: 1, scaleNear: 1, view: 'side' as const, blocked: [],
      walkable: [[{ x: 20, y: 100 }, { x: 80, y: 100 }, { x: 80, y: 190 }, { x: 20, y: 190 }]],
    };
    expect(frameInsetErrors(sideFixture, metrics, 90)).toEqual([]);
    expect(frameInsetErrors({
      ...sideFixture,
      walkable: [[{ x: 10, y: 100 }, ...sideFixture.walkable[0].slice(1)]],
    }, metrics, 90).some((error) => error.includes('crosses the page frame'))).toBe(true);
  });

  it('measures rendered alpha height against the painted reference', () => {
    const rendered = renderedAlphaHeight(metrics, 100);
    expect(rendered).toBe(90);
    expect(paintedScalePass(rendered, 91)).toBe(true);
    expect(paintedScalePass(rendered, 100)).toBe(false);
  });
});

describe('save', () => {
  it('round-trips through a store and rejects other versions', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    writeSave(store, 1, { map: 'street', actors: {}, inventory: { oden: 1 }, ink: '{}', introDone: true });
    expect(readSave(store, 1)?.inventory).toEqual({ oden: 1 });
    mem.set('code-j4.save.2', JSON.stringify({ version: 999 }));
    expect(readSave(store, 2)).toBeNull();
  });
  it('removes items that reach zero', () => {
    const inv: Record<string, number> = {};
    addItem(inv, 'oden');
    addItem(inv, 'oden', -1);
    expect(inv).toEqual({});
  });
});

describe('battle stub', () => {
  it('ends in a win when the party out-damages enemies', () => {
    const fs = createBattle({ name: 't', enemies: [{ name: 'rat', hp: 5, attack: 1 }], party: [{ id: 'a', hp: 30, attack: 10 }] }, (id) => id);
    playRound(fs, 'attack', () => 0);
    expect(outcome(fs)).toBe('win');
  });
});
