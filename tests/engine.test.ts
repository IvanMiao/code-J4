import { describe, expect, it } from 'vitest';
import { facingOf, sideFacing, step, walkable } from '../src/engine/walk.ts';
import { addItem, readSave, writeSave } from '../src/engine/save.ts';
import { createBattle, outcome, playRound } from '../src/engine/battle.ts';
import { parseMap } from '../src/engine/map.ts';
import { readFileSync } from 'node:fs';

const square = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]];

describe('walk', () => {
  it('stays inside the walkable area and slides along edges', () => {
    expect(walkable({ x: 50, y: 50 }, square)).toBe(true);
    expect(step({ x: 95, y: 50 }, { x: 10, y: 10 }, square)).toEqual({ x: 95, y: 60 });
    expect(step({ x: 99, y: 99 }, { x: 5, y: 5 }, square)).toEqual({ x: 99, y: 99 });
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
      art: null, view: 'top', player: 'linxia', dialogue: 'box', intro: null, scaleFar: 1, scaleNear: 1,
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
        { name: 'intro', value: 'ming_intro' },
        { name: 'scaleFar', value: '0.8' },
        { name: 'scaleNear', value: '1.25' },
      ],
    };
    expect(parseMap(fixture)).toMatchObject({
      art: 'ming', view: 'side', player: 'shen', dialogue: 'bubble', intro: 'ming_intro', scaleFar: 0.8, scaleNear: 1.25,
    });
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
