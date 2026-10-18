import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './game/config.ts';
import { BootScene } from './game/scenes/Boot.ts';
import { FieldScene } from './game/scenes/Field.ts';
import { BattleScene } from './game/scenes/Battle.ts';

// Canvas text needs the CJK web fonts loaded before the first Text object is drawn.
await Promise.race([
  Promise.all([
    document.fonts.load('12px "Fusion Pixel"', '中文字体'),
    ...['Hand Song', 'Hand Kai', 'Hand Brush', 'Hand Xing', 'Hand Rough'].map((family) => document.fonts.load(`24px "${family}"`, '中文字体')),
  ]),
  new Promise((r) => setTimeout(r, 3000)),
]);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#07090f',
  pixelArt: false,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, FieldScene, BattleScene],
});

(window as any).__game = game;
