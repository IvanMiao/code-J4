import Phaser from 'phaser';
import { ACTOR_HEIGHT, cast, style } from './config.ts';
import { facingOf, sideFacing, type Facing, type Vec } from '../engine/walk.ts';
import { PoseCycle } from '../engine/pose.ts';

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  face: Facing;
  private moving = false;
  private readonly side: boolean;
  private readonly pose: boolean;
  private readonly retro: boolean;
  private readonly mirrorRight: boolean;
  private readonly baseScale: number;
  private depth = { enabled: false, top: 0, bottom: 1, far: 1, near: 1 };
  private renderDepth?: number;
  private rate = 1;
  private readonly poseCycle?: PoseCycle;

  constructor(private scene: Phaser.Scene, readonly id: string, x: number, y: number) {
    const member = cast[id];
    this.pose = member.sheet === 'pose';
    this.side = member.sheet === 'side';
    this.retro = (member.art ?? style) === 'retro';
    this.mirrorRight = (member.art ?? style) === 'hd';
    this.face = this.side || this.pose ? 'right' : 'down';
    this.sprite = scene.add.sprite(x, y, `sheet:${id}`, this.pose ? 0 : this.side ? 4 : 1)
      .setOrigin(0.5, this.pose ? 1 : 0.96);
    if (this.pose) this.poseCycle = new PoseCycle();
    const frameH = this.sprite.frame.height;
    const target = member.height ?? ACTOR_HEIGHT[id] ?? 110;
    this.baseScale = this.pose ? 1 : this.retro ? Math.max(1, Math.round(target / frameH)) : target / frameH;
    this.sync();
  }

  get pos(): Vec {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  get height(): number {
    return this.sprite.displayHeight;
  }

  get isPose() {
    return this.pose;
  }

  update(dt: number) {
    if (this.pose) this.sprite.setFrame(this.poseCycle!.update(dt));
  }

  setPoseEngaged(engaged: boolean) {
    if (!this.pose) return;
    this.poseCycle!.setEngaged(engaged);
    this.sprite.setFrame(engaged ? 1 : 0);
  }

  setPos(p: Vec) {
    if (!this.pose) this.sprite.setPosition(p.x, p.y);
    this.sync();
  }

  setFace(f: Facing) {
    if (this.pose) return;
    this.face = this.side && (f === 'up' || f === 'down') ? (this.face === 'left' ? 'left' : 'right') : f;
    this.sync();
  }

  setDepthMap(enabled: boolean, top: number, bottom: number, far: number, near: number) {
    this.depth = { enabled, top, bottom, far, near };
    this.sync();
  }

  setRenderDepth(depth?: number) {
    this.renderDepth = depth;
    this.sync();
  }

  faceToward(p: Vec) {
    this.setFace(facingOf(p.x - this.sprite.x, p.y - this.sprite.y, this.face));
  }

  setMoving(m: boolean, rate = 1) {
    if (this.pose) return;
    this.moving = m;
    this.rate = m ? rate : 1;
    this.sync();
  }

  walkTo(p: Vec, speed = 120): Promise<void> {
    if (this.pose) return Promise.resolve();
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
        this.face = this.side ? sideFacing(dx, this.face) : facingOf(dx, dy, this.face);
        this.sprite.setPosition(this.sprite.x + (dx / dist) * stepLen, this.sprite.y + (dy / dist) * stepLen);
        this.setMoving(true);
      };
      this.scene.events.on('update', tick);
    });
  }

  private sync() {
    this.sprite.setDepth(this.renderDepth ?? this.sprite.y);
    if (this.pose) {
      this.sprite.setScale(1);
      return;
    }
    const scaleT = this.depth.enabled ? Phaser.Math.Clamp((this.sprite.y - this.depth.top) / Math.max(1, this.depth.bottom - this.depth.top), 0, 1) : 0;
    const scale = this.depth.enabled ? this.depth.far + (this.depth.near - this.depth.far) * scaleT : 1;
    this.sprite.setScale(this.baseScale * scale);
    this.sprite.setFlipX(!this.side && this.mirrorRight && this.face === 'right');
    const key = `${this.id}:walk:${this.face}`;
    if (this.moving) {
      if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
    } else {
      this.sprite.stop();
      const row = this.side ? (this.face === 'left' ? 0 : 1)
        : this.face === 'down' ? 0 : this.face === 'left' ? 1 : this.face === 'right' ? (this.mirrorRight ? 1 : 2) : 3;
      this.sprite.setFrame(row * 3 + 1);
    }
    this.sprite.anims.timeScale = this.rate;
  }
}
