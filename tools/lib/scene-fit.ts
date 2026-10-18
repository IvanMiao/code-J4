import type { FieldMap } from '../../src/engine/map.ts';

export interface SpriteMetrics {
  frameWidth: number;
  frameHeight: number;
  alphaWidth: number;
  alphaHeight: number;
}

export function scaleAtFeet(map: Pick<FieldMap, 'walkable' | 'scaleFar' | 'scaleNear'>, y: number) {
  const ys = map.walkable.flatMap((poly) => poly.map((p) => p.y));
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const t = Math.max(0, Math.min(1, (y - top) / Math.max(1, bottom - top)));
  return map.scaleFar + (map.scaleNear - map.scaleFar) * t;
}

export function renderedAlphaHeight(metrics: SpriteMetrics, castHeight: number, depthScale = 1) {
  return metrics.alphaHeight * castHeight / metrics.frameHeight * depthScale;
}

export function paintedScalePass(rendered: number, painted: number, tolerance = 0.02) {
  return Math.abs(rendered - painted) <= painted * tolerance;
}

export function frameInsetErrors(
  map: Pick<FieldMap, 'width' | 'height' | 'frameInset' | 'walkable' | 'scaleFar' | 'scaleNear'>,
  metrics: SpriteMetrics,
  castHeight: number,
) {
  const errors: string[] = [];
  for (const poly of map.walkable) {
    for (const p of poly) {
      const depth = scaleAtFeet(map, p.y);
      const base = castHeight / metrics.frameHeight * depth;
      const halfWidth = metrics.alphaWidth * base / 2;
      const head = p.y - renderedAlphaHeight(metrics, castHeight, depth);
      if (p.x - halfWidth < map.frameInset || p.x + halfWidth > map.width - map.frameInset) {
        errors.push(`walkable point (${p.x},${p.y}) crosses the page frame`);
      }
      if (head < map.frameInset || p.y > map.height - map.frameInset) {
        errors.push(`walkable point (${p.x},${p.y}) places the player outside the page frame`);
      }
    }
  }
  return errors;
}
