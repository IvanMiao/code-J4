import type { Facing, Polygon, Vec } from './walk.ts';

/** The subset of the Tiled .tmj format the game reads. */
interface TiledProperty { name: string; type?: string; value: unknown }
interface TiledObject {
  id: number; name: string; x: number; y: number; width?: number; height?: number;
  point?: boolean; polygon?: Vec[]; properties?: TiledProperty[];
}
interface TiledLayer { type: string; name: string; objects?: TiledObject[] }
interface TiledMap { width: number; height: number; tilewidth: number; tileheight: number; properties?: TiledProperty[]; layers: TiledLayer[] }

export interface MapActor { id: string; x: number; y: number; knot: string | null; face: string; depth?: number }
/** `face`: the direction the player must face to use it (i.e. the side it is used from). */
export interface MapTrigger { id: string; x: number; y: number; width: number; height: number; knot: string; auto: boolean; face: string | null; hidden: boolean; actor?: string; icon?: string; sfx?: string }

/** Decorative life (fountain spray, swaying grass, birds…) placed in a rect; `kind` picks the effect. */
export interface MapAmbient { kind: string; x: number; y: number; width: number; height: number; props: Record<string, string> }

/** A piece of the background redrawn above actors whose feet are above `baseline` (tree canopies, roofs). */
export interface MapForeground { polygon: Polygon; baseline: number }

/** Walking into the rect moves the player to `anchor` on `map`. */
export interface MapExit {
  id: string; x: number; y: number; width: number; height: number; map: string; anchor: string; face: Facing | null; sfx?: string;
}

export type ExitEdge = Facing;

export function exitEdge(exit: Pick<MapExit, 'x' | 'y' | 'width' | 'height' | 'face'>, mapW: number, mapH: number): ExitEdge {
  if (exit.x <= 0) return 'left';
  if (exit.x + exit.width >= mapW) return 'right';
  if (exit.y <= 0) return 'up';
  if (exit.y + exit.height >= mapH) return 'down';
  return exit.face ?? 'up';
}

export function exitCanBeUsed(exit: Pick<MapExit, 'face'>, facing: Facing): boolean {
  return !exit.face || exit.face === facing;
}

export function armExits(exits: readonly MapExit[], pos: Vec, armed: ReadonlySet<string>): Set<string> {
  const next = new Set(armed);
  for (const exit of exits) {
    if (!inRect(pos, exit)) next.add(exit.id);
  }
  return next;
}

export function pickExit(
  exits: readonly MapExit[],
  pos: Vec,
  facing: Facing,
  armed: ReadonlySet<string>,
): MapExit | undefined {
  return exits.find((exit) => armed.has(exit.id) && exitCanBeUsed(exit, facing) && inRect(pos, exit));
}

export interface FieldMap {
  title: string;
  width: number;
  height: number;
  background: string;
  art: string | null;
  view: 'top' | 'side';
  script: 'hans' | 'hant';
  player: string;
  dialogue: 'box' | 'bubble';
  intro: string | null;
  scaleFar: number;
  scaleNear: number;
  frameInset: number;
  paintedTitle: boolean;
  ground: string;
  bgm: string | null;
  ambience: string | null;
  walkable: Polygon[];
  blocked: Polygon[];
  exits: MapExit[];
  anchors: Record<string, Vec>;
  actors: MapActor[];
  triggers: MapTrigger[];
  foreground: MapForeground[];
  ambient: MapAmbient[];
}

const prop = (o: { properties?: TiledProperty[] }, name: string) => o.properties?.find((p) => p.name === name)?.value;

export function parseMap(raw: string | TiledMap): FieldMap {
  const map: TiledMap = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const layer = (name: string) => map.layers.find((l) => l.type === 'objectgroup' && l.name === name)?.objects ?? [];
  const poly = (o: TiledObject) => (o.polygon ?? []).map((p) => ({ x: p.x + o.x, y: p.y + o.y }));
  const rect = (o: TiledObject) => ({ id: o.name, x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0 });
  const triggers = layer('triggers');
  const view = String(prop(map, 'view') ?? 'top');
  const script = String(prop(map, 'script') ?? 'hans');
  const dialogue = String(prop(map, 'dialogue') ?? 'box');
  const art = prop(map, 'art');
  const intro = prop(map, 'intro');
  return {
    title: String(prop(map, 'title') ?? ''),
    width: map.width * map.tilewidth,
    height: map.height * map.tileheight,
    background: String(prop(map, 'background') ?? ''),
    art: art == null || art === '' ? null : String(art),
    view: view === 'side' ? 'side' : 'top',
    script: script === 'hant' ? 'hant' : 'hans',
    player: String(prop(map, 'player') ?? 'linxia'),
    dialogue: dialogue === 'bubble' ? 'bubble' : 'box',
    intro: intro == null || intro === '' ? null : String(intro),
    scaleFar: Number(prop(map, 'scaleFar') ?? 1),
    scaleNear: Number(prop(map, 'scaleNear') ?? 1),
    frameInset: Number(prop(map, 'frameInset') ?? 0),
    paintedTitle: String(prop(map, 'paintedTitle') ?? 'false') === 'true',
    ground: String(prop(map, 'ground') ?? 'stone'),
    bgm: (prop(map, 'bgm') as string) ?? null,
    ambience: (prop(map, 'ambience') as string) ?? null,
    walkable: layer('walkable').map(poly),
    blocked: layer('blocked').map(poly),
    exits: triggers.filter((o) => prop(o, 'exit')).map((o) => {
      const [m, anchor] = String(prop(o, 'exit')).split(':');
      return {
        ...rect(o), map: m, anchor,
        face: prop(o, 'face') == null ? null : String(prop(o, 'face')) as Facing,
        sfx: (prop(o, 'sfx') as string) ?? undefined,
      };
    }),
    anchors: Object.fromEntries(layer('anchors').map((o) => [o.name, { x: o.x, y: o.y }])),
    actors: layer('actors').map((o) => {
      const depth = prop(o, 'depth');
      return {
        id: o.name, x: o.x, y: o.y, knot: (prop(o, 'knot') as string) ?? null, face: (prop(o, 'face') as string) ?? 'down',
        depth: depth == null ? undefined : Number(depth),
      };
    }),
    triggers: triggers.filter((o) => !prop(o, 'exit')).map((o) => ({
      ...rect(o),
      knot: String(prop(o, 'knot') ?? o.name), auto: prop(o, 'auto') === true, face: (prop(o, 'face') as string) ?? null,
      hidden: String(prop(o, 'hidden')) === 'true',
      actor: (prop(o, 'actor') as string) ?? undefined,
      icon: (prop(o, 'icon') as string) ?? undefined,
      sfx: (prop(o, 'sfx') as string) ?? undefined,
    })),
    foreground: layer('foreground').map((o) => {
      const polygon = poly(o);
      return { polygon, baseline: Number(prop(o, 'baseline') ?? Math.max(...polygon.map((p) => p.y))) };
    }),
    ambient: layer('ambient').map((o) => ({
      ...rect(o), kind: String(prop(o, 'kind') ?? o.name),
      props: Object.fromEntries((o.properties ?? []).map((p) => [p.name, String(p.value)])),
    })),
  };
}

export function inRect(p: Vec, r: { x: number; y: number; width: number; height: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}
