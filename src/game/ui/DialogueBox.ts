import Phaser from 'phaser';
import { cast, FONT, PORTRAIT_HEIGHT } from '../config.ts';
import type { LineEvent } from '../../story/parse.ts';
import { pixelFrame } from './frame.ts';
import { plainText } from '../../engine/handwriting.ts';

const BOX = { x: 16, y: 392, w: 928, h: 136 };
const CPS = 36;

/** 仙剑-style dialogue box: portrait on the left, name plate, typewriter text. */
export class DialogueBox {
  private root: Phaser.GameObjects.Container;
  private portrait: Phaser.GameObjects.Image;
  private name: Phaser.GameObjects.Text;
  private namePlate: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private full = '';
  private shown = 0;
  private typing?: Phaser.Time.TimerEvent;
  private done?: () => void;

  constructor(private scene: Phaser.Scene) {
    const g = pixelFrame(scene.add.graphics(), BOX.x, BOX.y, BOX.w, BOX.h);
    this.portrait = scene.add.image(BOX.x + 18, BOX.y + BOX.h - 4, '__DEFAULT').setOrigin(0, 1).setVisible(false);
    this.namePlate = scene.add.graphics();
    this.name = scene.add.text(0, BOX.y - 18, '', { fontFamily: FONT, fontSize: '24px', color: '#ffe7a3' }).setOrigin(0, 0.5);
    this.body = scene.add.text(0, BOX.y + 24, '', {
      fontFamily: FONT, fontSize: '24px', color: '#f4ead2', lineSpacing: 12, wordWrap: { width: 600, useAdvancedWrap: true },
    });
    this.arrow = scene.add.text(BOX.x + BOX.w - 30, BOX.y + BOX.h - 30, '▼', { fontFamily: FONT, fontSize: '24px', color: '#e6c77a' }).setVisible(false);
    scene.tweens.add({ targets: this.arrow, y: '+=4', yoyo: true, repeat: -1, duration: 400 });
    this.root = scene.add.container(0, 0, [g, this.portrait, this.namePlate, this.name, this.body, this.arrow]).setDepth(10_000).setVisible(false).setScrollFactor(0, 0, true);
  }

  get open() {
    return this.root.visible;
  }

  show(line: LineEvent): Promise<void> {
    const member = line.speaker ? cast[line.speaker] : null;
    const emo = member && line.emotion && member.portraits?.[line.emotion] ? line.emotion : member?.default;
    const key = member ? `portrait:${line.speaker}:${emo}` : null;
    let textX = BOX.x + 32;
    if (key && this.scene.textures.exists(key)) {
      this.portrait.setTexture(key).setVisible(true);
      this.portrait.setScale(PORTRAIT_HEIGHT / this.portrait.height);
      textX = BOX.x + 18 + this.portrait.displayWidth + 24;
    } else {
      this.portrait.setVisible(false);
    }
    this.namePlate.clear();
    this.name.setText(member?.name ?? '');
    if (member) {
      this.name.setX(textX + 12);
      const w = this.name.width + 24;
      this.namePlate.fillStyle(0x1a120a, 1).fillRect(textX, BOX.y - 36, w, 38);
      this.namePlate.fillStyle(0xe6c77a, 1).fillRect(textX + 2, BOX.y - 34, w - 4, 34);
      this.namePlate.fillStyle(0x4a2f17, 1).fillRect(textX + 4, BOX.y - 32, w - 8, 30);
    }
    this.body.setX(textX).setWordWrapWidth(BOX.x + BOX.w - 40 - textX);
    this.full = plainText(line.text);
    this.shown = 0;
    this.body.setText('');
    this.arrow.setVisible(false);
    this.root.setVisible(true);
    this.typing?.remove();
    this.typing = this.scene.time.addEvent({
      delay: 1000 / CPS,
      loop: true,
      callback: () => {
        this.shown++;
        this.body.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) this.finishTyping();
      },
    });
    return new Promise((resolve) => (this.done = resolve));
  }

  /** Confirm pressed: first completes the text, second advances. */
  confirm() {
    if (!this.root.visible || !this.done) return;
    if (this.shown < this.full.length) return this.finishTyping();
    const done = this.done;
    this.done = undefined;
    done();
  }

  hide() {
    this.root.setVisible(false);
  }

  private finishTyping() {
    this.typing?.remove();
    this.typing = undefined;
    this.shown = this.full.length;
    this.body.setText(this.full);
    this.arrow.setVisible(true);
  }
}
