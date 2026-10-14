import { describe, expect, it } from 'vitest';
import { facingOf, step, walkable, walkableFoot } from '../src/engine/walk.ts';
import { addItem, readSave, writeSave } from '../src/engine/save.ts';
import { createBattle, outcome, playRound } from '../src/engine/battle.ts';

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
