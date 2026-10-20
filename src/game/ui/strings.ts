import type { FieldMap } from '../../engine/map.ts';

export const UI_STRINGS = {
  hans: {
    controls: '方向键/WASD 移动 · Shift 跑 · 空格/Enter 交互 · Esc 菜单',
    interact: '空格',
    menu: '菜单',
    save: '存档',
    load: '读档',
    back: '返回',
    toMing: '前往古代线',
    toCampus: '返回校园',
    saved: '已存档',
    loaded: '已读档',
    noSave: '没有存档',
    gained: '获得',
    lost: '失去',
    reloaded: '剧本已热更新',
  },
  hant: {
    controls: '方向鍵/WASD 移動 · Shift 跑步 · 空格/Enter 互動 · Esc 選單',
    interact: '空格',
    menu: '選單',
    save: '存檔',
    load: '讀檔',
    back: '返回',
    toMing: '前往古代線',
    toCampus: '返回校園',
    saved: '已存檔',
    loaded: '已讀檔',
    noSave: '沒有存檔',
    gained: '獲得',
    lost: '失去',
    reloaded: '劇本已熱更新',
  },
} as const;

export type UiStrings = (typeof UI_STRINGS)[FieldMap['script']];
