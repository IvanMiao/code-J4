import type Phaser from 'phaser';

/** Square pixel window in the 98 style: dark rim, gold line, bronze bevel, navy fill, gold corner studs. */
export function pixelFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(0x1a120a, 1).fillRect(x, y, w, h);
  g.fillStyle(0xe6c77a, 1).fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(0x7a5528, 1).fillRect(x + 4, y + 4, w - 8, h - 8);
  g.fillStyle(0x131b2f, 1).fillRect(x + 8, y + 8, w - 16, h - 16);
  g.fillStyle(0x1c2742, 1).fillRect(x + 8, y + 8, w - 16, 4);
  g.fillStyle(0xe6c77a, 1);
  for (const [cx, cy] of [[x, y], [x + w - 8, y], [x, y + h - 8], [x + w - 8, y + h - 8]]) g.fillRect(cx, cy, 8, 8);
  return g;
}
