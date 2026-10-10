export interface Vec { x: number; y: number }
export type Polygon = Vec[];

export function insidePolygon(p: Vec, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function walkable(p: Vec, areas: Polygon[]): boolean {
  return areas.some((poly) => insidePolygon(p, poly));
}

/** Moves from `from` by `delta`, sliding along edges when the full step leaves the walkable area. */
export function step(from: Vec, delta: Vec, areas: Polygon[]): Vec {
  const full = { x: from.x + delta.x, y: from.y + delta.y };
  if (walkable(full, areas)) return full;
  const xOnly = { x: from.x + delta.x, y: from.y };
  if (delta.x && walkable(xOnly, areas)) return xOnly;
  const yOnly = { x: from.x, y: from.y + delta.y };
  if (delta.y && walkable(yOnly, areas)) return yOnly;
  return from;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

export function facingOf(dx: number, dy: number, fallback: Facing): Facing {
  if (!dx && !dy) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

export function facingVec(f: Facing): Vec {
  return { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[f];
}
