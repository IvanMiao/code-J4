import Phaser from 'phaser';
import { HANDS, FONT } from '../config.ts';
import { pixelFrame } from './frame.ts';

/** Vertical choice list (keyboard ↑↓ + confirm, or mouse). */
export class ChoiceMenu {
  private root?: Phaser.GameObjects.Container;
  private index = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private markers: Phaser.GameObjects.Text[] = [];
  private resolve?: (i: number) => void;
  private theme: 'pixel' | 'paper' = 'pixel';

  constructor(private scene: Phaser.Scene) {}

  get open() {
    return !!this.root;
  }

  setTheme(theme: 'pixel' | 'paper') {
    this.theme = theme;
  }

  show(options: string[], opts: { x?: number; y?: number; title?: string } = {}): Promise<number> {
    this.close();
    const size = this.theme === 'paper' ? 22 : 24;
    const width = Math.min(920, Math.max(240, ...options.map((o) => o.length * size + 80)));
    const rowH = 40;
    const h = options.length * rowH + 32 + (opts.title ? 36 : 0);
    const x = opts.x ?? 940 - width, y = opts.y ?? 380 - h;
    let g: Phaser.GameObjects.Graphics;
    if (this.theme === 'paper') {
      g = this.scene.add.graphics();
      g.fillStyle(0xefe3c4, 0.97).lineStyle(2, 0x2a1d12, 1);
      g.fillRoundedRect(0, 0, width, h, 12).strokeRoundedRect(0, 0, width, h, 12);
    } else {
      g = pixelFrame(this.scene.add.graphics(), 0, 0, width, h);
    }
    const items: Phaser.GameObjects.GameObject[] = [g];
    let top = 16;
    if (opts.title) {
      items.push(this.scene.add.text(20, top, opts.title, {
        fontFamily: this.theme === 'paper' ? HANDS.song.family : FONT,
        fontSize: `${size}px`,
        color: this.theme === 'paper' ? '#9b2d1f' : '#e6c77a',
      }).setResolution(this.theme === 'paper' ? 2 : 1));
      top += 36;
    }
    this.rows = options.map((o, i) => {
      const t = this.scene.add.text(this.theme === 'paper' ? 48 : 20, top + i * rowH + 6, o, {
        fontFamily: this.theme === 'paper' ? HANDS.kai.family : FONT,
        fontSize: `${size}px`,
        color: this.theme === 'paper' ? '#22170d' : '#f4ead2',
      }).setResolution(this.theme === 'paper' ? 2 : 1);
      t.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          this.select(i);
          this.confirm();
        });
      return t;
    });
    this.markers = this.theme === 'paper'
      ? options.map((_, i) => this.scene.add.text(2, top + i * rowH + 6, '●', {
          fontFamily: HANDS.kai.family, fontSize: '18px', color: '#9b2d1f',
        }).setResolution(2).setVisible(false))
      : [];
    items.push(...this.rows, ...this.markers);
    this.root = this.scene.add.container(x, y, items).setDepth(10_100).setScrollFactor(0, 0, true);
    this.select(0);
    return new Promise((r) => (this.resolve = r));
  }

  move(delta: number) {
    if (this.root) this.select((this.index + delta + this.rows.length) % this.rows.length);
  }

  confirm() {
    if (!this.resolve) return;
    const r = this.resolve, i = this.index;
    this.resolve = undefined;
    this.close();
    r(i);
  }

  private select(i: number) {
    this.index = i;
    if (this.theme === 'paper') {
      this.markers.forEach((marker, j) => marker.setVisible(j === i));
    } else {
      this.rows.forEach((t, j) => t.setText(`${j === i ? '▶ ' : '　'}${t.text.replace(/^(▶ |　)/, '')}`).setColor(j === i ? '#ffe7a3' : '#b8ae96'));
    }
  }

  private close() {
    this.root?.destroy();
    this.root = undefined;
  }
}
