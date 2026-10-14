import Phaser from 'phaser';

const PX = 2;
const COLORS: Record<string, string> = { k: '#1a120a', f: '#f4ead2', a: '#e6c77a' };
const ICONS = ['talk', 'look', 'door', 'use'] as const;

export function ensureInteractionHintTextures(scene: Phaser.Scene) {
  for (const icon of ICONS) {
    const key = `hint:${icon}`;
    if (scene.textures.exists(key)) continue;
    const rows = Array.from({ length: 12 }, () => Array(14).fill('.'));
    const pixel = (x: number, y: number, color: string) => { rows[y][x] = color; };
    for (let y = 0; y < 10; y++) {
      const inset = y === 0 || y === 9 ? 3 : y === 1 || y === 8 ? 2 : 1;
      for (let x = inset; x < 14 - inset; x++) pixel(x, y, x === inset || x === 13 - inset || y === 0 || y === 9 ? 'k' : 'f');
    }
    pixel(4, 1, 'a');
    pixel(9, 1, 'a');
    for (let x = 6; x <= 9; x++) pixel(x, 10, 'k');
    pixel(7, 11, 'k');
    pixel(8, 11, 'k');

    if (icon === 'talk') {
      for (const x of [4, 6, 8]) pixel(x, 5, 'k');
      for (const x of [4, 6, 8]) pixel(x, 6, 'a');
    } else if (icon === 'look') {
      for (let x = 5; x <= 8; x++) pixel(x, 3, 'k');
      pixel(4, 4, 'k'); pixel(9, 4, 'k');
      pixel(5, 5, 'k'); pixel(6, 5, 'a'); pixel(7, 5, 'a'); pixel(8, 5, 'k');
      pixel(9, 6, 'k'); pixel(10, 7, 'k');
    } else if (icon === 'door') {
      for (let y = 3; y <= 7; y++) pixel(4, y, 'k'), pixel(9, y, 'k');
      for (let x = 4; x <= 9; x++) pixel(x, 3, 'k'), pixel(x, 7, 'k');
      for (let y = 4; y <= 6; y++) for (let x = 5; x <= 8; x++) pixel(x, y, 'a');
      pixel(8, 6, 'k');
    } else {
      const hand: [number, number, string][] = [
        [5, 3, 'k'], [6, 3, 'k'], [7, 3, 'k'], [5, 4, 'a'], [6, 4, 'a'], [7, 4, 'a'],
        [4, 4, 'k'], [4, 5, 'a'], [8, 4, 'k'], [8, 5, 'a'], [9, 5, 'k'], [9, 6, 'a'],
        [8, 7, 'k'], [7, 8, 'k'], [5, 8, 'k'], [4, 7, 'k'], [3, 6, 'k'],
        [5, 5, 'a'], [6, 5, 'a'], [7, 5, 'a'], [5, 6, 'a'], [6, 6, 'a'], [7, 6, 'a'],
        [5, 7, 'a'], [6, 7, 'a'], [7, 7, 'a'],
      ];
      for (const [x, y, color] of hand) pixel(x, y, color);
    }

    const texture = scene.textures.createCanvas(key, 14 * PX, 12 * PX)!;
    rows.forEach((row, y) => row.forEach((color, x) => {
      if (color === '.') return;
      texture.context.fillStyle = COLORS[color];
      texture.context.fillRect(x * PX, y * PX, PX, PX);
    }));
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}
