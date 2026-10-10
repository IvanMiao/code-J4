import type { Polygon, Vec } from './walk.ts';

/** The subset of the Tiled .tmj format the game reads. */
interface TiledProperty { name: string; type?: string; value: unknown }
interface TiledObject {
  id: number; name: string; x: number; y: number; width?: number; height?: number;
  point?: boolean; polygon?: Vec[]; properties?: TiledProperty[];
}
interface TiledLayer { type: string; name: string; objects?: TiledObject[] }
interface TiledMap { properties?: TiledProperty[]; layers: TiledLayer[] }

export interface MapActor { id: string; x: number; y: number; knot: string | null; face: string }
export interface MapTrigger { id: string; x: number; y: number; width: number; height: number; knot: string; auto: boolean }

export interface FieldMap {
  background: string;
  walkable: Polygon[];
  anchors: Record<string, Vec>;
  actors: MapActor[];
  triggers: MapTrigger[];
}

const prop = (o: { properties?: TiledProperty[] }, name: string) => o.properties?.find((p) => p.name === name)?.value;

export function parseMap(raw: string | TiledMap): FieldMap {
  const map: TiledMap = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const layer = (name: string) => map.layers.find((l) => l.type === 'objectgroup' && l.name === name)?.objects ?? [];
  return {
    background: String(prop(map, 'background') ?? ''),
    walkable: layer('walkable').map((o) => (o.polygon ?? []).map((p) => ({ x: p.x + o.x, y: p.y + o.y }))),
    anchors: Object.fromEntries(layer('anchors').map((o) => [o.name, { x: o.x, y: o.y }])),
    actors: layer('actors').map((o) => ({
      id: o.name, x: o.x, y: o.y, knot: (prop(o, 'knot') as string) ?? null, face: (prop(o, 'face') as string) ?? 'down',
    })),
    triggers: layer('triggers').map((o) => ({
      id: o.name, x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0,
      knot: String(prop(o, 'knot') ?? o.name), auto: prop(o, 'auto') === true,
    })),
  };
}

export function inRect(p: Vec, r: { x: number; y: number; width: number; height: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}
