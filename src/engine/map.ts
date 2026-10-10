import type { Polygon, Vec } from './walk.ts';

/** The subset of the Tiled .tmj format the game reads. */
interface TiledProperty { name: string; type?: string; value: unknown }
interface TiledObject {
  id: number; name: string; x: number; y: number; width?: number; height?: number;
  point?: boolean; polygon?: Vec[]; properties?: TiledProperty[];
}
interface TiledLayer { type: string; name: string; objects?: TiledObject[] }
interface TiledMap { width: number; height: number; tilewidth: number; tileheight: number; properties?: TiledProperty[]; layers: TiledLayer[] }

export interface MapActor { id: string; x: number; y: number; knot: string | null; face: string }
/** `face`: the direction the player must face to use it (i.e. the side it is used from). */
export interface MapTrigger { id: string; x: number; y: number; width: number; height: number; knot: string; auto: boolean; face: string | null }

/** A piece of the background redrawn above actors whose feet are above `baseline` (tree canopies, roofs). */
export interface MapForeground { polygon: Polygon; baseline: number }

/** Walking into the rect moves the player to `anchor` on `map`. */
export interface MapExit { id: string; x: number; y: number; width: number; height: number; map: string; anchor: string }

export interface FieldMap {
  title: string;
  width: number;
  height: number;
  background: string;
  bgm: string | null;
  ambience: string | null;
  walkable: Polygon[];
  blocked: Polygon[];
  exits: MapExit[];
  anchors: Record<string, Vec>;
  actors: MapActor[];
  triggers: MapTrigger[];
  foreground: MapForeground[];
}

const prop = (o: { properties?: TiledProperty[] }, name: string) => o.properties?.find((p) => p.name === name)?.value;

export function parseMap(raw: string | TiledMap): FieldMap {
  const map: TiledMap = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const layer = (name: string) => map.layers.find((l) => l.type === 'objectgroup' && l.name === name)?.objects ?? [];
  const poly = (o: TiledObject) => (o.polygon ?? []).map((p) => ({ x: p.x + o.x, y: p.y + o.y }));
  const rect = (o: TiledObject) => ({ id: o.name, x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0 });
  const triggers = layer('triggers');
  return {
    title: String(prop(map, 'title') ?? ''),
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    background: String(prop(map, 'background') ?? ''),
    bgm: (prop(map, 'bgm') as string) ?? null,
    ambience: (prop(map, 'ambience') as string) ?? null,
    walkable: layer('walkable').map(poly),
    blocked: layer('blocked').map(poly),
    exits: triggers.filter((o) => prop(o, 'exit')).map((o) => {
      const [m, anchor] = String(prop(o, 'exit')).split(':');
      return { ...rect(o), map: m, anchor };
    }),
    anchors: Object.fromEntries(layer('anchors').map((o) => [o.name, { x: o.x, y: o.y }])),
    actors: layer('actors').map((o) => ({
      id: o.name, x: o.x, y: o.y, knot: (prop(o, 'knot') as string) ?? null, face: (prop(o, 'face') as string) ?? 'down',
    })),
    triggers: triggers.filter((o) => !prop(o, 'exit')).map((o) => ({
      ...rect(o),
      knot: String(prop(o, 'knot') ?? o.name), auto: prop(o, 'auto') === true, face: (prop(o, 'face') as string) ?? null,
    })),
    foreground: layer('foreground').map((o) => {
      const polygon = poly(o);
      return { polygon, baseline: Number(prop(o, 'baseline') ?? Math.max(...polygon.map((p) => p.y))) };
    }),
  };
}

export function inRect(p: Vec, r: { x: number; y: number; width: number; height: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}
