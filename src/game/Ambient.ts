import Phaser from 'phaser';
import type { MapAmbient } from '../engine/map.ts';
import type { Vec } from '../engine/walk.ts';

/** One background pixel in world units (960px art drawn on a 1920px map). */
const PX = 2;

const SPARROW = { c: '#8a4a26', w: '#f2eee2', k: '#1e1a18', g: '#6b625a', b: '#a07448', B: '#4a3424', p: '#d3c8b6', t: '#5e4632', l: '#7a5a40' };

/** Tiny pixel textures; `#` = white (tinted at runtime), other letters map to fixed colours. Birds face left. */
const SPRITES: Record<string, { rows: string[]; colors?: Record<string, string> }> = {
  tuft: { rows: ['..#..', '#.#.#', '.###.', '.###.'] },
  flower: { rows: ['.#.', '###', '.#.', '.s.', '.s.'], colors: { s: '#4c7a34' } },
  leaf: { rows: ['##.', '.##'] },
  drop: { rows: ['#'] },
  mote: { rows: ['#'] },
  sparkle: { rows: ['..#..', '..#..', '##.##', '..#..', '..#..'] },
  shadow: { rows: ['.ssss.', 'ssssss'], colors: { s: '#000000' } },
  sparrow: { rows: ['..ccc.....', '.ccccc....', 'gkcwwbBb..', '.kwkwbbBbt', '..kppbBbtt', '...ppppb..', '....l.l...'], colors: SPARROW },
  sparrow_peck: { rows: ['..........', '.....bB...', '..cccbbBbt', '.ccccwbBtt', 'gkcwkppb..', '.kkwpppp..', '...l..l...'], colors: SPARROW },
  sparrow_up: { rows: ['....Bb....', '..ccbBb...', '.cccbbBbtt', 'gkwwpbbt..', '.kpppp....'], colors: SPARROW },
  sparrow_down: { rows: ['..cc......', '.ccccbbBtt', 'gkwwpbBt..', '.kppbBb...', '....Bb....'], colors: SPARROW },
  wing: { rows: ['##.##', '##b##', '.#.#.'], colors: { b: '#3a2a20' } },
};

type Sway = { obj: Phaser.GameObjects.Image; phase: number; amp: number };
type Bird = { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; area: MapAmbient; state: 'ground' | 'away'; next: number };
type Fly = { img: Phaser.GameObjects.Image; area: MapAmbient; target: Vec; phase: number };
type Ring = { x: number; y: number; r0: number; r1: number; aspect: number; t: number; dur: number; alpha: number };
type Pool = { g: Phaser.GameObjects.Graphics; color: number; rings: Ring[] };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;

/** Per-map decorative motion. Created on map change, ticked from the scene's update. */
export class Ambient {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  private sway: Sway[] = [];
  private birds: Bird[] = [];
  private flies: Fly[] = [];
  private pools: Pool[] = [];
  private t = 0;
  private lastFlush = -10;
  private pixels: ImageData;
  private k: number;

  constructor(
    private scene: Phaser.Scene,
    bgKey: string,
    mapWidth: number,
    specs: MapAmbient[],
    private flag: (name: string) => boolean = () => false,
    private sound: (id: string) => void = () => undefined,
  ) {
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
      case 'birds': return this.flock(a, n || 3);
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

  private zone(a: MapAmbient) {
    return { type: 'random', source: new Phaser.Geom.Rectangle(a.x, a.y, a.width, a.height) } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData;
  }

  private leaves(a: MapAmbient) {
    this.keep(this.scene.add.particles(0, 0, 'amb:leaf', {
      emitZone: this.zone(a), lifespan: { min: 4000, max: 6500 }, speedY: { min: 18, max: 34 }, speedX: { min: -16, max: 26 },
      rotate: { start: 0, end: 300 }, alpha: { start: 1, end: 0 }, frequency: Number(a.props.every ?? 1400),
      tint: [0x9bb54c, 0xd9b44a, 0xc7883a, 0x7f9e3e],
    }).setDepth(4000));
  }

  private motes(a: MapAmbient) {
    this.keep(this.scene.add.particles(0, 0, 'amb:mote', {
      emitZone: this.zone(a), lifespan: { min: 2500, max: 4500 }, speedY: { min: -8, max: 6 }, speedX: { min: 4, max: 14 },
      alpha: { start: 0.75, end: 0 }, frequency: 260, tint: 0xfff2c4, blendMode: 'ADD',
    }).setDepth(4001));
  }

  /**
   * Finds the water inside the rect (bluish background pixels), paints out the ripple lines drawn into the
   * background, then keeps rings expanding from the jet plus small rings where drops land.
   */
  private fountain(a: MapAmbient) {
    const k = this.k, W = this.pixels.width, d = this.pixels.data;
    const x0 = Math.floor(a.x * k), y0 = Math.floor(a.y * k), w = Math.ceil(a.width * k), h = Math.ceil(a.height * k);
    const water: number[] = [];
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 2] > d[i] + 12 && d[i + 2] >= d[i + 1] - 4) water.push(i);
      }
    if (!water.length) return;
    const ls = water.map((i) => lum(d[i], d[i + 1], d[i + 2])).sort((p, q) => p - q);
    const median = ls[Math.floor(ls.length / 2)];
    const base = water.find((i) => Math.abs(lum(d[i], d[i + 1], d[i + 2]) - median) < 1.5) ?? water[0];
    const [br, bg, bb] = [d[base], d[base + 1], d[base + 2]];
    const cover = this.scene.textures.createCanvas(`amb:pool:${a.x}:${a.y}`, w, h) ?? (this.scene.textures.get(`amb:pool:${a.x}:${a.y}`) as Phaser.Textures.CanvasTexture);
    cover.context.clearRect(0, 0, w, h);
    cover.context.fillStyle = `rgb(${br},${bg},${bb})`;
    let sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const i of water) {
      const x = (i / 4) % W, y = Math.floor(i / 4 / W);
      sx += x; sy += y;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      cover.context.fillRect(x - x0, y - y0, 1, 1);
    }
    // Flat water hides the ripples painted into the background; keep a darker rim shadow along the top edge.
    cover.context.fillStyle = `rgb(${Math.round(br * 0.82)},${Math.round(bg * 0.84)},${Math.round(bb * 0.88)})`;
    const topOf = new Map<number, number>();
    for (const i of water) {
      const x = (i / 4) % W, y = Math.floor(i / 4 / W);
      topOf.set(x, Math.min(topOf.get(x) ?? Infinity, y));
    }
    for (const [x, y] of topOf) cover.context.fillRect(x - x0, y - y0, 1, 3);
    cover.refresh();
    this.keep(this.scene.add.image(x0 / k, y0 / k, cover.key).setOrigin(0).setScale(1 / k).setDepth(1));
    const cx = sx / water.length / k, cy = sy / water.length / k;
    const rx = ((maxX - minX) / 2 / k) * 0.86, aspect = (maxY - minY) / (maxX - minX || 1);
    const light = Phaser.Display.Color.GetColor(Math.min(255, br + 60), Math.min(255, bg + 55), Math.min(255, bb + 40));
    const pool: Pool = { g: this.keep(this.scene.add.graphics().setDepth(2)), color: light, rings: [] };
    this.pools.push(pool);
    const top = cy - Number(a.props.spout ?? 14);
    this.keep(this.scene.add.particles(cx, top, 'amb:drop', {
      speedY: { min: -235, max: -195 }, speedX: { min: -18, max: 18 }, lifespan: 1000, frequency: 9, scale: { start: 1.5, end: 1 },
      tint: [0xffffff, 0xd8f1ff, 0xb9e2ff], alpha: { start: 0.95, end: 0.6 }, gravityY: 420,
    }).setDepth(a.y + a.height));
    const ring = (x: number, y: number, r0: number, r1: number, dur: number, alpha: number) => pool.rings.push({ x, y, r0, r1, aspect, t: 0, dur, alpha });
    for (let i = 0; i < 4; i++) ring(cx, cy, 8, rx, 3200, 0.8), (pool.rings[i].t = i * 800);
    this.timers.push(this.scene.time.addEvent({ delay: 800, loop: true, callback: () => ring(cx, cy, 8, rx, 3200, 0.8) }));
    this.timers.push(this.scene.time.addEvent({
      delay: 260, loop: true,
      callback: () => {
        const ang = rand(0, Math.PI * 2), r = rand(0.08, 0.3) * rx;
        ring(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * aspect, 2, rand(10, 16), 900, 0.7);
      },
    }));
  }

  private drawPools(dt: number) {
    for (const p of this.pools) {
      p.g.clear();
      p.rings = p.rings.filter((r) => (r.t += dt) < r.dur);
      for (const r of p.rings) {
        const q = r.t / r.dur;
        const rad = Math.round((r.r0 + (r.r1 - r.r0) * Math.sqrt(q)) / PX) * PX;
        p.g.lineStyle(PX, p.color, r.alpha * (1 - q) * Math.min(1, q * 6));
        p.g.strokeEllipse(Math.round(r.x / PX) * PX, Math.round(r.y / PX) * PX, rad * 2, Math.max(PX, Math.round((rad * 2 * r.aspect) / PX) * PX));
      }
    }
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

  /** Sparrows land in a loose group, hop and peck, and flush together when someone comes close. */
  private flock(area: MapAmbient, n: number) {
    const c = this.spot(area);
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(c.x + rand(-60, 60), area.x, area.x + area.width);
      const y = Phaser.Math.Clamp(c.y + rand(-24, 24), area.y, area.y + area.height);
      const shadow = this.keep(this.scene.add.image(x, y, 'amb:shadow').setOrigin(0.5, 0.5).setScale(1.5).setAlpha(0.22).setDepth(y - 1));
      const img = this.keep(this.scene.add.image(x, y, 'amb:sparrow').setOrigin(0.5, 1).setScale(1.5).setDepth(y).setFlipX(Math.random() < 0.5));
      this.birds.push({ img, shadow, area, state: 'ground', next: rand(300, 1500) });
    }
  }

  /** Every bird on the map takes off at once (e.g. after a loud noise). */
  scare() {
    for (const b of this.birds) if (b.state === 'ground') this.flee(b, b.img.x + (Math.random() < 0.5 ? -1 : 1));
  }

  private flee(b: Bird, fromX: number) {
    if (this.t - this.lastFlush > 1.5) {
      this.lastFlush = this.t;
      this.sound('sparrow_flush');
    }
    for (const o of this.birds) if (o !== b && o.state === 'ground' && Math.hypot(o.img.x - b.img.x, o.img.y - b.img.y) < 160) this.takeOff(o, fromX);
    this.takeOff(b, fromX);
  }

  private takeOff(b: Bird, fromX: number) {
    b.state = 'away';
    b.next = rand(7000, 12000);
    b.shadow.setVisible(false);
    const dir = b.img.x < fromX ? -1 : 1;
    b.img.setFlipX(dir > 0).setDepth(4000);
    this.scene.tweens.add({
      targets: b.img, x: b.img.x + dir * rand(380, 480), y: b.img.y - rand(320, 420), duration: 1200, ease: 'Sine.easeIn',
      onUpdate: () => b.img.setTexture(Math.floor(this.t * 14) % 2 ? 'amb:sparrow_up' : 'amb:sparrow_down'),
      onComplete: () => b.img.setVisible(false),
    });
  }

  private land(b: Bird, player: Vec) {
    let p = this.spot(b.area);
    for (let i = 0; i < 6 && Math.hypot(p.x - player.x, p.y - player.y) < 260; i++) p = this.spot(b.area);
    b.state = 'ground';
    b.next = rand(800, 2000);
    b.img.setPosition(p.x + rand(-200, 200), p.y - 220).setVisible(true).setDepth(4000);
    b.img.setFlipX(b.img.x < p.x);
    this.scene.tweens.add({
      targets: b.img, x: p.x, y: p.y, duration: 1000, ease: 'Sine.easeOut',
      onUpdate: () => b.img.setTexture(Math.floor(this.t * 12) % 2 ? 'amb:sparrow_up' : 'amb:sparrow_down'),
      onComplete: () => {
        b.img.setTexture('amb:sparrow').setDepth(p.y);
        b.shadow.setPosition(p.x, p.y).setDepth(p.y - 1).setVisible(true);
      },
    });
  }

  private tickBird(b: Bird, dt: number, player: Vec) {
    b.next -= dt;
    if (b.state === 'away') {
      if (b.next <= 0) this.land(b, player);
      return;
    }
    if (!b.img.visible || b.next > 1e8) return;
    if (Math.hypot(b.img.x - player.x, b.img.y - player.y) < 110) return this.flee(b, player.x);
    if (b.next > 0) return;
    b.next = rand(350, 1600);
    const roll = Math.random();
    if (roll < 0.45) {
      b.img.setTexture('amb:sparrow_peck');
      this.scene.time.delayedCall(160, () => b.state === 'ground' && b.img.setTexture('amb:sparrow'));
      if (Math.random() < 0.5) this.scene.time.delayedCall(320, () => b.state === 'ground' && b.img.setTexture('amb:sparrow_peck'));
      this.scene.time.delayedCall(480, () => b.state === 'ground' && b.img.setTexture('amb:sparrow'));
    } else if (roll < 0.6) {
      b.img.setFlipX(!b.img.flipX);
    } else {
      const facingRight = b.img.flipX;
      const dx = (facingRight ? 1 : -1) * rand(10, 22);
      const to = Phaser.Math.Clamp(b.img.x + dx, b.area.x, b.area.x + b.area.width);
      const y = b.img.y;
      this.scene.tweens.add({ targets: b.img, x: to, duration: 160 });
      this.scene.tweens.add({ targets: b.img, y: y - 6, duration: 80, yoyo: true, onComplete: () => b.img.setY(y) });
      this.scene.tweens.add({ targets: b.shadow, x: to, duration: 160 });
    }
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
    this.drawPools(dt);
  }

  destroy() {
    for (const tm of this.timers) tm.remove();
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.sway = [];
    this.birds = [];
    this.flies = [];
    this.pools = [];
  }
}
