import castYaml from '../../content/cast/cast.yaml';
import itemsYaml from '../../content/data/items.yaml';
import encountersYaml from '../../content/data/encounters.yaml';
import streetMap from '../../content/maps/street.tmj?raw';
import type { Cast, Item } from '../engine/content.ts';
import type { Encounter } from '../engine/battle.ts';
import { parseMap } from '../engine/map.ts';

export const WIDTH = 960;
export const HEIGHT = 540;
export const FONT = '"Noto Sans SC","Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';

export type StyleId = 'retro' | 'hd';
export const STYLE_LABEL: Record<StyleId, string> = { retro: '复古', hd: '高清' };

export const params = new URLSearchParams(location.search);
export const style: StyleId = params.get('style') === 'retro' ? 'retro' : 'hd';

export const cast = castYaml as Cast;
export const items = itemsYaml as Record<string, Item>;
export const encounters = encountersYaml as Record<string, Encounter>;
export const fieldMap = parseMap(streetMap);

/** On-screen height (px, 960×540 world) of each actor's walk frame. */
export const ACTOR_HEIGHT: Record<string, number> = { linxia: 118, juzi: 58 };
export const PORTRAIT_HEIGHT = 220;

export const artUrl = (file: string) => `${import.meta.env.BASE_URL}art/${style}/${file}.png`;
export const audioUrl = (path: string) => `${import.meta.env.BASE_URL}audio/${path}`;

export interface AudioIndex { bgm?: Record<string, string>; ambience?: Record<string, string>; sfx?: Record<string, string>; vo?: Record<string, string> }
