import Phaser from 'phaser';
import { ACTOR_HEIGHT, style } from './config.ts';
import { DIR_ROW } from './scenes/Boot.ts';
import { facingOf, type Facing, type Vec } from '../engine/walk.ts';

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  face: Facing = 'down';
  private moving = false;

  constructor(private scene: Phaser.Scene, readonly id: string, x: number, y: number) {
    this.sprite = scene.add.sprite(x, y, `sheet:${id}`, 1).setOrigin(0.5, 0.96);
    const frameH = this.sprite.frame.height;
    const target = ACTOR_HEIGHT[id] ?? 110;
    const scale = style === 'retro' ? Math.max(1, Math.round(target / frameH)) : target / frameH;
    this.sprite.setScale(scale);
    this.sync();
  }

  get pos(): Vec {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get height(): number {
    return this.sprite.displayHeight;
  }

  setPos(p: Vec) {
    this.sprite.setPosition(p.x, p.y);
    this.sync();
  }

  setFace(f: Facing) {
    this.face = f;
    this.sync();
  }

  faceToward(p: Vec) {
    this.setFace(facingOf(p.x - this.sprite.x, p.y - this.sprite.y, this.face));
  }

  setMoving(m: boolean) {
    this.moving = m;
    this.sync();
  }

  walkTo(p: Vec, speed = 120): Promise<void> {
    return new Promise((resolve) => {
      const tick = (_t: number, dt: number) => {
        const dx = p.x - this.sprite.x, dy = p.y - this.sprite.y;
        const dist = Math.hypot(dx, dy);
        const stepLen = (speed * dt) / 1000;
        if (dist <= stepLen) {
          this.scene.events.off('update', tick);
          this.setPos(p);
          this.setMoving(false);
          return resolve();
        }
        this.face = facingOf(dx, dy, this.face);
        this.sprite.setPosition(this.sprite.x + (dx / dist) * stepLen, this.sprite.y + (dy / dist) * stepLen);
        this.setMoving(true);
      };
      this.scene.events.on('update', tick);
    });
  }

  private sync() {
    this.sprite.setDepth(this.sprite.y);
    this.sprite.setFlipX(this.face === 'right');
    const key = `${this.id}:walk:${this.face}`;
    if (this.moving) {
      if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
    } else {
      this.sprite.stop();
      this.sprite.setFrame(DIR_ROW[this.face] * 3 + 1);
    }
  }
}
