import Phaser from 'phaser';
import type { MapAmbient } from '../engine/map.ts';
import type { Vec } from '../engine/walk.ts';

/** One background pixel in world units (960px art drawn on a 1920px map). */
const PX = 2;

/** Tiny pixel textures; `#` = white (tinted at runtime), other letters map to fixed colours. */
const SPRITES: Record<string, { rows: string[]; colors?: Record<string, string> }> = {
  tuft: { rows: ['..#..', '#.#.#', '.###.', '.###.'] },
  flower: { rows: ['.#.', '###', '.#.', '.s.', '.s.'], colors: { s: '#4c7a34' } },
  leaf: { rows: ['##.', '.##'] },
  drop: { rows: ['#'] },
  mote: { rows: ['#'] },
  bird: { rows: ['.hh..', 'hbbbt', '.bbb.', '.f.f.'], colors: { h: '#4a3022', b: '#9b6a43', t: '#6e4a30', f: '#3a2a20' } },
  sparkle: { rows: ['..#..', '..#..', '##.##', '..#..', '..#..'] },
  wing: { rows: ['##.##', '##b##', '.#.#.'], colors: { b: '#3a2a20' } },
};

type Sway = { obj: Phaser.GameObjects.Image; phase: number; amp: number };
type Bird = { img: Phaser.GameObjects.Image; area: MapAmbient; state: 'ground' | 'away'; next: number };
type Fly = { img: Phaser.GameObjects.Image; area: MapAmbient; target: Vec; phase: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Per-map decorative motion. Created on map change, ticked from the scene's update. */
export class Ambient {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private sway: Sway[] = [];
  private birds: Bird[] = [];
  private flies: Fly[] = [];
  private t = 0;
  private pixels: ImageData;
  private k: number;

  constructor(private scene: Phaser.Scene, bgKey: string, mapWidth: number, specs: MapAmbient[], private flag: (name: string) => boolean = () => false) {
    Ambient.ensureTextures(scene);
    const src = scene.textures.get(bgKey).getSourceImage() as HTMLImageElement;
    this.k = src.width / mapWidth;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0);
    this.pixels = ctx.getImageData(0, 0, c.width, c.height);
    for (const s of specs) this.add(s);
  }

  static ensureTextures(scene: Phaser.Scene) {
    for (const [name, { rows, colors }] of Object.entries(SPRITES)) {
      const key = `amb:${name}`;
      if (scene.textures.exists(key)) continue;
      const tex = scene.textures.createCanvas(key, rows[0].length * PX, rows.length * PX)!;
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        tex.context.fillStyle = ch === '#' ? '#ffffff' : colors![ch];
        tex.context.fillRect(x * PX, y * PX, PX, PX);
      }));
      tex.refresh();
    }
  }

  private color(x: number, y: number): [number, number, number] {
    const px = Math.min(this.pixels.width - 1, Math.max(0, Math.round(x * this.k)));
    const py = Math.min(this.pixels.height - 1, Math.max(0, Math.round(y * this.k)));
    const i = (py * this.pixels.width + px) * 4;
    return [this.pixels.data[i], this.pixels.data[i + 1], this.pixels.data[i + 2]];
  }

  private spot(a: MapAmbient): Vec {
    return { x: rand(a.x, a.x + a.width), y: rand(a.y, a.y + a.height) };
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  private add(a: MapAmbient) {
    const n = Number(a.props.n ?? 0);
    switch (a.kind) {
      case 'grass': return this.plants(a, n || Math.round((a.width * a.height) / 2400), 'amb:tuft', ([r, g, b]) => g > r + 8 && g > b + 8, 1.18);
      case 'flowers': return this.plants(a, n || Math.round((a.width * a.height) / 900), 'amb:flower', ([r, g, b]) => r > g + 20 || (r > 200 && g > 180 && b < 140) || (r > 210 && g > 210 && b > 200), 1.08);
      case 'leaves': return this.leaves(a);
      case 'motes': return this.motes(a);
      case 'fountain': return this.fountain(a);
      case 'birds': for (let i = 0; i < (n || 3); i++) this.bird(a); return;
      case 'glint': return this.glint(a);
      case 'butterflies': for (let i = 0; i < (n || 2); i++) this.butterfly(a); return;
    }
  }

  /** Small sprites tinted from the background under them, swaying with travelling wind gusts. */
  private plants(a: MapAmbient, n: number, tex: string, accept: (c: [number, number, number]) => boolean, lift: number) {
    for (let tries = 0, made = 0; made < n && tries < n * 8; tries++) {
      const p = this.spot(a);
      const c = this.color(p.x, p.y);
      if (!accept(c)) continue;
      const tint = Phaser.Display.Color.GetColor(...(c.map((v) => Math.min(255, Math.round(v * lift))) as [number, number, number]));
      const obj = this.keep(this.scene.add.image(Math.round(p.x / PX) * PX, Math.round(p.y / PX) * PX, tex).setOrigin(0.5, 1).setTint(tint).setDepth(p.y));
      this.sway.push({ obj, phase: rand(0, Math.PI * 2), amp: rand(6, 12) });
      made++;
    }
  }

  private leaves(a: MapAmbient) {
    const e = this.scene.add.particles(0, 0, 'amb:leaf', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(a.x, a.y, a.width, a.height) } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 4000, max: 6500 }, speedY: { min: 18, max: 34 }, speedX: { min: -16, max: 26 },
      rotate: { start: 0, end: 300 }, alpha: { start: 1, end: 0 }, frequency: Number(a.props.every ?? 1400),
      tint: [0x9bb54c, 0xd9b44a, 0xc7883a, 0x7f9e3e],
    }).setDepth(4000);
    this.keep(e);
  }

  private motes(a: MapAmbient) {
    const e = this.scene.add.particles(0, 0, 'amb:mote', {
      emitZone: { type: 'random', source: new Phaser.Geom.Rectangle(a.x, a.y, a.width, a.height) } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
      lifespan: { min: 2500, max: 4500 }, speedY: { min: -8, max: 6 }, speedX: { min: 4, max: 14 },
      alpha: { start: 0.75, end: 0 }, frequency: 260, tint: 0xfff2c4, blendMode: 'ADD',
    }).setDepth(4001);
    this.keep(e);
  }

  /** Spray from the spout (rect centre), splashes and ripples on the water (the rect). */
  private fountain(a: MapAmbient) {
    const cx = a.x + a.width / 2, cy = a.y + a.height / 2;
    const top = cy - Number(a.props.spout ?? 14);
    const depth = a.y + a.height;
    const jet = { tint: [0xffffff, 0xd8f1ff, 0xb9e2ff], alpha: { start: 0.95, end: 0.5 }, gravityY: 420 };
    this.keep(this.scene.add.particles(cx, top, 'amb:drop', { ...jet, speedY: { min: -235, max: -195 }, speedX: { min: -18, max: 18 }, lifespan: 1000, frequency: 9, scale: { start: 1.5, end: 1 } }).setDepth(depth));
    this.keep(this.scene.add.particles(cx, top - 4, 'amb:drop', { ...jet, speedY: { min: -110, max: -70 }, speedX: { min: -85, max: 85 }, lifespan: 600, frequency: 18 }).setDepth(depth));
    const ripple = () => {
      const ang = rand(0, Math.PI * 2), d = rand(0, 0.55);
      const x = cx + Math.cos(ang) * a.width * 0.5 * d, y = cy + Math.sin(ang) * a.height * 0.5 * d;
      const r = this.keep(this.scene.add.ellipse(x, y, 10, 6).setStrokeStyle(2, 0xeaf7ff, 0.7).setDepth(a.y));
      r.isFilled = false;
      this.scene.tweens.add({ targets: r, scaleX: rand(3, 5), scaleY: rand(3, 5), alpha: 0, duration: rand(1100, 1600), onComplete: () => r.destroy() });
    };
    const glint = () => {
      const g = this.keep(this.scene.add.image(rand(a.x + a.width * 0.15, a.x + a.width * 0.85), rand(a.y + a.height * 0.2, a.y + a.height * 0.8), 'amb:drop').setDepth(a.y).setAlpha(0));
      this.scene.tweens.add({ targets: g, alpha: 1, duration: 220, yoyo: true, onComplete: () => g.destroy() });
    };
    this.timers.push(this.scene.time.addEvent({ delay: 380, loop: true, callback: ripple }));
    this.timers.push(this.scene.time.addEvent({ delay: 170, loop: true, callback: glint }));
  }

  /** Faint twinkle marking a hidden spot until the ink variable in `until` turns true. */
  private glint(a: MapAmbient) {
    const img = this.keep(this.scene.add.image(a.x, a.y, 'amb:sparkle').setDepth(4002).setAlpha(0).setBlendMode('ADD'));
    const twinkle = () => {
      if (a.props.until && this.flag(a.props.until)) return;
      img.setScale(0.4).setAlpha(0);
      this.scene.tweens.add({ targets: img, alpha: 0.9, scale: 1, duration: 260, yoyo: true, hold: 120 });
    };
    this.timers.push(this.scene.time.addEvent({ delay: Number(a.props.every ?? 2600), startAt: rand(0, 2000), loop: true, callback: twinkle }));
  }

  /** Every bird on the map takes off at once (e.g. after a loud noise). */
  scare() {
    for (const b of this.birds) if (b.state === 'ground') { b.next = 0; this.flee(b, b.img.x + (Math.random() < 0.5 ? -1 : 1)); }
  }

  private flee(b: Bird, fromX: number) {
    b.state = 'away';
    b.next = rand(6000, 11000);
    const dir = b.img.x < fromX ? -1 : 1;
    b.img.setFlipX(dir > 0).setDepth(4000);
    this.scene.tweens.add({ targets: b.img, x: b.img.x + dir * 420, y: b.img.y - 380, duration: 1100, ease: 'Sine.easeIn', onComplete: () => b.img.setVisible(false) });
  }

  private bird(area: MapAmbient) {
    const p = this.spot(area);
    const img = this.keep(this.scene.add.image(p.x, p.y, 'amb:bird').setOrigin(0.5, 1).setDepth(p.y).setFlipX(Math.random() < 0.5));
    this.birds.push({ img, area, state: 'ground', next: rand(300, 1500) });
  }

  private butterfly(area: MapAmbient) {
    const p = this.spot(area);
    const img = this.keep(this.scene.add.image(p.x, p.y, 'amb:wing').setTint(pick([0xffffff, 0xfff1a0, 0xffd0e8])).setDepth(4000));
    this.flies.push({ img, area, target: this.spot(area), phase: rand(0, 10) });
  }

  update(dt: number, player: Vec) {
    this.t += dt / 1000;
    const t = this.t;
    for (const s of this.sway) {
      const gust = Math.max(0, Math.sin(t * 0.7 - s.obj.x * 0.004));
      s.obj.setAngle(s.amp * (0.3 * Math.sin(t * 2.1 + s.phase) + 0.9 * gust * gust));
    }
    for (const b of this.birds) this.tickBird(b, dt, player);
    for (const f of this.flies) {
      const dx = f.target.x - f.img.x, dy = f.target.y - f.img.y, d = Math.hypot(dx, dy);
      if (d < 6) f.target = this.spot(f.area);
      const v = (34 * dt) / 1000;
      f.img.x += (dx / (d || 1)) * v;
      f.img.y += (dy / (d || 1)) * v + Math.sin(t * 5 + f.phase) * 0.5;
      f.img.scaleX = 0.25 + 0.75 * Math.abs(Math.sin(t * 13 + f.phase));
    }
  }

  private tickBird(b: Bird, dt: number, player: Vec) {
    b.next -= dt;
    if (b.state === 'away') {
      if (b.next > 0) return;
      let p = this.spot(b.area);
      for (let i = 0; i < 6 && Math.hypot(p.x - player.x, p.y - player.y) < 260; i++) p = this.spot(b.area);
      b.state = 'ground';
      b.next = rand(800, 2000);
      b.img.setPosition(p.x, p.y - 220).setVisible(true).setDepth(4000);
      this.scene.tweens.add({ targets: b.img, y: p.y, duration: 900, ease: 'Sine.easeOut', onComplete: () => b.img.setDepth(p.y) });
      return;
    }
    if (Math.hypot(b.img.x - player.x, b.img.y - player.y) < 110) {
      this.flee(b, player.x);
      return;
    }
    if (b.next > 0) return;
    b.next = rand(400, 1800);
    if (Math.random() < 0.55) {
      this.scene.tweens.add({ targets: b.img, y: b.img.y + 2, duration: 90, yoyo: true });
    } else {
      const dx = rand(-24, 24), to = Phaser.Math.Clamp(b.img.x + dx, b.area.x, b.area.x + b.area.width);
      b.img.setFlipX(dx > 0);
      this.scene.tweens.add({ targets: b.img, x: to, y: b.img.y - 6, duration: 120, yoyo: true });
    }
  }

  destroy() {
    for (const tm of this.timers) tm.remove();
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.sway = [];
    this.birds = [];
    this.flies = [];
  }
}
