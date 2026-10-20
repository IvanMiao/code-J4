import castYaml from '../../content/cast/cast.yaml';
import itemsYaml from '../../content/data/items.yaml';
import encountersYaml from '../../content/data/encounters.yaml';
import type { Cast, Item } from '../engine/content.ts';
import type { Encounter } from '../engine/battle.ts';
import { parseMap, type FieldMap } from '../engine/map.ts';

export const WIDTH = 960;
export const HEIGHT = 540;
/** Fusion Pixel is a 12px bitmap design: use it at 12/24/36px only. */
export const FONT = '"Fusion Pixel","Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';

export type StyleId = 'retro' | 'hd';
export const STYLE_LABEL: Record<StyleId, string> = { retro: '复古', hd: '高清' };

export const params = new URLSearchParams(location.search);
export const style: StyleId = params.get('style') === 'hd' ? 'hd' : 'retro';

export const cast = castYaml as Cast;
export const items = itemsYaml as Record<string, Item>;
export const encounters = encountersYaml as Record<string, Encounter>;
const mapFiles = import.meta.glob('../../content/maps/*.tmj', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const maps: Record<string, FieldMap> = Object.fromEntries(
  Object.entries(mapFiles).map(([path, raw]) => [path.split('/').pop()!.replace(/\.tmj$/, ''), parseMap(raw)]),
);
export const START = { map: 'gate', anchor: 'player_start' };
export const ANCIENT_START = { map: 'ming_canal_street', anchor: 'player_start' };

/** On-screen height (px, 960×540 world) of each actor's walk frame. */
export const ACTOR_HEIGHT: Record<string, number> = { linxia: 96, nika: 64 };
export const PORTRAIT_HEIGHT = 220;

export const artUrl = (file: string, dir: string = style) => `${import.meta.env.BASE_URL}art/${dir}/${file}.png`;
export const audioUrl = (path: string) => `${import.meta.env.BASE_URL}audio/${path}`;

export const HANDS: Record<string, { family: string; size: number }> = {
  song: { family: 'Hand Song TC', size: 22 },
  kai: { family: 'Hand Kai TC', size: 26 },
  brush: { family: 'Hand Brush TC', size: 28 },
  xing: { family: 'Hand Xing TC', size: 28 },
  rough: { family: 'Hand Rough TC', size: 26 },
};

export interface AudioIndex { bgm?: Record<string, string>; ambience?: Record<string, string>; sfx?: Record<string, string>; vo?: Record<string, string> }
