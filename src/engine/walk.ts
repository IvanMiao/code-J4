export interface Vec { x: number; y: number }

/** How far in front of the player interactions are probed. */
export const REACH = 30;
export const FOOT = { w: 28, h: 10 };
export type Polygon = Vec[];

export function insidePolygon(p: Vec, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function walkable(p: Vec, areas: Polygon[], blocked: Polygon[] = []): boolean {
  return areas.some((poly) => insidePolygon(p, poly)) && !blocked.some((poly) => insidePolygon(p, poly));
}

export function walkableFoot(p: Vec, areas: Polygon[], blocked: Polygon[] = [], foot = FOOT): boolean {
  const x0 = p.x - foot.w / 2, x1 = p.x + foot.w / 2, y0 = p.y - foot.h, y1 = p.y;
  return [
    { x: x0, y: y0 }, { x: x1, y: y0 },
    { x: x0, y: y1 }, { x: x1, y: y1 },
    { x: p.x, y: y1 },
  ].every((corner) => walkable(corner, areas, blocked));
}

/** Moves from `from` by `delta`, sliding along edges when the full step leaves the walkable area. */
export function step(from: Vec, delta: Vec, areas: Polygon[], blocked: Polygon[] = [], foot = FOOT): Vec {
  const full = { x: from.x + delta.x, y: from.y + delta.y };
  if (walkableFoot(full, areas, blocked, foot)) return full;
  const xOnly = { x: from.x + delta.x, y: from.y };
  if (delta.x && walkableFoot(xOnly, areas, blocked, foot)) return xOnly;
  const yOnly = { x: from.x, y: from.y + delta.y };
  if (delta.y && walkableFoot(yOnly, areas, blocked, foot)) return yOnly;
  return from;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

export function facingOf(dx: number, dy: number, fallback: Facing): Facing {
  if (!dx && !dy) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

export function sideFacing(dx: number, fallback: Facing): Facing {
  if (dx < 0) return 'left';
  if (dx > 0) return 'right';
  return fallback === 'left' || fallback === 'right' ? fallback : 'right';
}

export function facingVec(f: Facing): Vec {
  return { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[f];
}
