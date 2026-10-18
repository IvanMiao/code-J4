import Phaser from 'phaser';
import { cast, HANDS, HEIGHT, WIDTH } from '../config.ts';
import type { Actor } from '../Actor.ts';
import type { LineEvent } from '../../story/parse.ts';
import { layoutGlyphs, parseCorrections } from '../../engine/handwriting.ts';

const PAPER = 0xefe3c4;
const CARMINE = '#9b2d1f';

/** Handwritten, actor-anchored dialogue for paper-style maps. */
export class SpeechBubble {
  private root: Phaser.GameObjects.Container;
  private glyphs: Phaser.GameObjects.Text[] = [];
  private strikes: Phaser.GameObjects.Graphics[] = [];
  private arrow?: Phaser.GameObjects.Text;
  private typing = false;
  private timer?: Phaser.Time.TimerEvent;
  private done?: () => void;
  private index = 0;

  constructor(private scene: Phaser.Scene, private actorFor: (id: string) => Actor | undefined) {
    this.root = scene.add.container(0, 0).setDepth(10_000).setScrollFactor(0).setVisible(false);
  }

  get open() {
    return this.root.visible;
  }

  show(line: LineEvent): Promise<void> {
    this.timer?.remove();
    this.root.removeAll(true);
    this.glyphs = [];
    this.strikes = [];
    this.index = 0;
    this.typing = true;

    const member = line.speaker ? cast[line.speaker] : null;
    const actor = member && line.speaker ? this.actorFor(line.speaker) : undefined;
    const camera = this.scene.cameras.main;
    const actorOnscreen = !!actor?.sprite.visible && camera.worldView.contains(actor.pos.x, actor.pos.y);
    const hand = actorOnscreen
      ? HANDS[member?.hand ?? 'kai'] ?? HANDS.kai
      : HANDS.song;
    const maxCols = actorOnscreen ? 14 : 38;
    const fontSize = hand.size;
    const segments = parseCorrections(line.text);
    const layout = layoutGlyphs(segments, maxCols);
    const rows = Math.max(1, ...layout.map((glyph) => glyph.row + 1));
    const cols = Math.min(maxCols, Math.max(1, ...layout.map((glyph) => glyph.col + 1)));
    const width = Math.min(WIDTH - 32, cols * fontSize + 32);
    const height = rows * fontSize + 28;
    const tail = actorOnscreen ? 20 : 0;
    let x: number;
    let y: number;
    let speakerX = 0;
    let speakerY = 0;
    let tailOnTop = false;
    if (actorOnscreen && actor) {
      speakerX = (actor.pos.x - camera.scrollX) * camera.zoom + camera.x;
      speakerY = (actor.pos.y - actor.height * 0.88 - camera.scrollY) * camera.zoom + camera.y;
      x = Phaser.Math.Clamp(speakerX - width / 2, 16, WIDTH - width - 16);
      const above = speakerY - height - tail;
      tailOnTop = above < 36;
      y = tailOnTop
        ? Phaser.Math.Clamp(speakerY + tail, 36, HEIGHT - height - 16)
        : Phaser.Math.Clamp(above, 36, HEIGHT - height - tail - 16);
    } else {
      x = (WIDTH - width) / 2;
      y = 24;
    }
    const background = this.scene.add.graphics();
    const tailX = actorOnscreen && actor
      ? Phaser.Math.Clamp(speakerX - x, 24, width - 24)
      : width / 2;
    if (actorOnscreen) {
      background.fillStyle(PAPER, 0.96).lineStyle(2, 0x2a1d12, 1);
      const tailBase = tailOnTop ? 0 : height - 1;
      const tailTip = tailOnTop ? -tail : height + tail;
      background.fillTriangle(tailX - 12, tailBase, tailX + 12, tailBase, tailX, tailTip);
      background.lineBetween(tailX - 12, tailBase, tailX, tailTip);
      background.lineBetween(tailX + 12, tailBase, tailX, tailTip);
    }
    background.fillStyle(PAPER, 0.96).lineStyle(2, 0x2a1d12, 1);
    background.fillRoundedRect(0, 0, width, height, 12).strokeRoundedRect(0, 0, width, height, 12);
    this.root.add(background);

    for (const glyph of layout) {
      const text = this.scene.add.text(16 + glyph.col * fontSize, 12 + glyph.row * fontSize, glyph.ch, {
        fontFamily: hand.family,
        fontSize: `${fontSize}px`,
        color: '#22170d',
      }).setResolution(2).setOrigin(0, 0).setAlpha(0).setScale(1.15);
      this.root.add(text);
      this.glyphs.push(text);
    }

    const strikeGroups = new Map<number, typeof layout>();
    layout.forEach((glyph) => {
      if (glyph.struck) strikeGroups.set(glyph.seg, [...(strikeGroups.get(glyph.seg) ?? []), glyph]);
    });
    const lastGlyphOfSegment = new Map<number, number>();
    layout.forEach((glyph, i) => lastGlyphOfSegment.set(glyph.seg, i));
    const strikesBySegment = new Map<number, Phaser.GameObjects.Graphics[]>();
    for (const [seg, glyphs] of strikeGroups) {
      const byRow = new Map<number, number[]>();
      glyphs.forEach((glyph) => byRow.set(glyph.row, [...(byRow.get(glyph.row) ?? []), glyph.col]));
      const graphics: Phaser.GameObjects.Graphics[] = [];
      for (const [row, positions] of byRow) {
        const start = Math.min(...positions), end = Math.max(...positions);
        const mark = this.scene.add.graphics().setAlpha(0).setScale(0, 1);
        mark.fillStyle(0x9b2d1f, 0.95).fillRect(
          18 + start * fontSize,
          12 + row * fontSize + fontSize * 0.56,
          Math.max(8, (end - start + 1) * fontSize - 4),
          3,
        );
        this.root.add(mark);
        this.strikes.push(mark);
        graphics.push(mark);
      }
      strikesBySegment.set(seg, graphics);
    }

    if (member && actorOnscreen) {
      this.root.add(this.scene.add.text(10, -24, member.name, {
        fontFamily: HANDS.song.family, fontSize: '16px', color: CARMINE,
      }).setResolution(2));
    }
    this.arrow = this.scene.add.text(width - 24, height - 22, '▼', {
      fontFamily: hand.family, fontSize: `${Math.min(fontSize, 18)}px`, color: CARMINE,
    }).setOrigin(0.5).setVisible(false);
    this.root.add(this.arrow);

    this.root.setPosition(x, y).setVisible(true);

    return new Promise((resolve) => {
      this.done = resolve;
      const showNext = () => {
        if (this.index >= this.glyphs.length) {
          this.finishTyping();
          return;
        }
        const glyphIndex = this.index++;
        const glyph = layout[glyphIndex];
        const text = this.glyphs[glyphIndex];
        text.setVisible(true);
        this.scene.tweens.add({ targets: text, alpha: 1, scale: 1, duration: 140, ease: 'Sine.Out' });
        const delay = 1000 / 22 + ('。！？，'.includes(glyph.ch) ? 120 : 0);
        if (lastGlyphOfSegment.get(glyph.seg) === glyphIndex && strikesBySegment.has(glyph.seg)) {
          const marks = strikesBySegment.get(glyph.seg)!;
          this.scene.tweens.add({
            targets: marks,
            alpha: 1,
            scaleX: 1,
            duration: 180,
            onComplete: () => { this.timer = this.scene.time.delayedCall(delay + 150, showNext); },
          });
        } else {
          this.timer = this.scene.time.delayedCall(delay, showNext);
        }
      };
      showNext();
    });
  }

  confirm() {
    if (!this.root.visible || !this.done) return;
    if (this.typing) {
      this.finishTyping();
      return;
    }
    const done = this.done;
    this.done = undefined;
    done();
  }

  hide() {
    this.timer?.remove();
    this.root.setVisible(false);
  }

  private finishTyping() {
    this.timer?.remove();
    this.timer = undefined;
    this.typing = false;
    for (const glyph of this.glyphs) glyph.setVisible(true).setAlpha(1).setScale(1);
    for (const mark of this.strikes) mark.setAlpha(1).setScale(1, 1);
    this.arrow?.setVisible(true);
  }
}
