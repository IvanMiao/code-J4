import Phaser from 'phaser';
import { FONT } from '../config.ts';

/** Vertical choice list (keyboard ↑↓ + confirm, or mouse). */
export class ChoiceMenu {
  private root?: Phaser.GameObjects.Container;
  private index = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private resolve?: (i: number) => void;

  constructor(private scene: Phaser.Scene) {}

  get open() {
    return !!this.root;
  }

  show(options: string[], opts: { x?: number; y?: number; title?: string } = {}): Promise<number> {
    this.close();
    const width = Math.max(240, ...options.map((o) => o.length * 22 + 70));
    const rowH = 40;
    const h = options.length * rowH + 24 + (opts.title ? 34 : 0);
    const x = opts.x ?? 940 - width, y = opts.y ?? 380 - h;
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d1422, 0.94).fillRoundedRect(0, 0, width, h, 8);
    g.lineStyle(2, 0xd9b86c, 1).strokeRoundedRect(0, 0, width, h, 8);
    const items: Phaser.GameObjects.GameObject[] = [g];
    let top = 12;
    if (opts.title) {
      items.push(this.scene.add.text(20, top, opts.title, { fontFamily: FONT, fontSize: '18px', color: '#d9b86c' }).setResolution(2));
      top += 34;
    }
    this.rows = options.map((o, i) => {
      const t = this.scene.add.text(20, top + i * rowH + 6, o, { fontFamily: FONT, fontSize: '21px', color: '#f1ece0' }).setResolution(2);
      t.setInteractive({ useHandCursor: true })
        .on('pointerover', () => this.select(i))
        .on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          this.select(i);
          this.confirm();
        });
      return t;
    });
    items.push(...this.rows);
    this.root = this.scene.add.container(x, y, items).setDepth(10_100);
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
    this.rows.forEach((t, j) => t.setText(`${j === i ? '▶ ' : '　'}${t.text.replace(/^(▶ |　)/, '')}`).setColor(j === i ? '#ffe39a' : '#c9c2b0'));
  }

  private close() {
    this.root?.destroy();
    this.root = undefined;
  }
}
