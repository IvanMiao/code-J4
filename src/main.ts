import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './game/config.ts';
import { BootScene } from './game/scenes/Boot.ts';
import { FieldScene } from './game/scenes/Field.ts';
import { BattleScene } from './game/scenes/Battle.ts';

// Canvas text needs the CJK web font loaded before the first Text object is drawn.
await Promise.race([document.fonts.load('22px "Noto Sans SC"', '中文字体'), new Promise((r) => setTimeout(r, 3000))]);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#07090f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, FieldScene, BattleScene],
});

(window as any).__game = game;
