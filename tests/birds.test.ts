import { describe, expect, it } from 'vitest';
import { birdReaction, SPARROW_PARAMS } from '../src/engine/birds.ts';

const base = {
  distance: 300,
  playerSpeed: 0,
  stillFor: 0,
  catDistance: 500,
  bold: false,
  alertFor: 500,
  species: SPARROW_PARAMS,
};

describe('birdReaction', () => {
  it('flushes when a cat is inside the species radius', () => {
    expect(birdReaction({ ...base, catDistance: 149 })).toBe('flush');
  });

  it('flushes a runner inside the species run radius', () => {
    expect(birdReaction({ ...base, distance: 189, playerSpeed: 331 })).toBe('flush');
  });

  it('flushes at panic distance', () => {
    expect(birdReaction({ ...base, distance: 54 })).toBe('flush');
  });

  it('alerts first when a moving player approaches within walk radius', () => {
    expect(birdReaction({ ...base, distance: 109, playerSpeed: 1, alertFor: 349 })).toBe('alert');
  });

  it('hops away after the alert window', () => {
    expect(birdReaction({ ...base, distance: 109, playerSpeed: 1, alertFor: 350 })).toBe('hop_away');
  });

  it('lets a bold bird approach a still player within curiosity range', () => {
    expect(birdReaction({ ...base, distance: 120, stillFor: 2001, bold: true })).toBe('curious');
  });

  it('otherwise remains calm and respects strict range boundaries', () => {
    expect(birdReaction({ ...base, distance: 170, stillFor: 4000, bold: true })).toBe('none');
    expect(birdReaction({ ...base, distance: 110, playerSpeed: 1, alertFor: 500 })).toBe('none');
    expect(birdReaction({ ...base, distance: 54, playerSpeed: 420 })).toBe('flush');
  });
});
