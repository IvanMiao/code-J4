import Phaser from 'phaser';
import { birdReaction, SPARROW_PARAMS, type SpeciesParams } from '../engine/birds.ts';
import type { MapAmbient } from '../engine/map.ts';
import type { Vec } from '../engine/walk.ts';

/** One background pixel in world units (960px art drawn on a 1920px map). */
const PX = 2;

const SPARROW = { c: '#8a4a26', w: '#f2eee2', k: '#1e1a18', g: '#6b625a', b: '#a07448', B: '#4a3424', p: '#d3c8b6', t: '#5e4632', l: '#7a5a40' };
const PIGEON = { g: '#778b9d', k: '#24282d', G: '#4f927b', P: '#795e91', b: '#4e6273', p: '#d3d5d5', o: '#b47b3d', t: '#41484f' };
const GULL = { w: '#f2f0e8', g: '#77818a', k: '#292d31', y: '#e3be54', p: '#d1d4d1' };
const CROW = { k: '#202632', b: '#526780', g: '#82909d', p: '#c0c4c6' };

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
  pigeon: { rows: ['..ggg.....', '.ggggg....', 'gkgGPGg...', 'gkgggGbB..', '.gppggbBtt', '..gppg.....', '...g.g.....'], colors: PIGEON },
  pigeon_peck: { rows: ['..........', '.....o....', '..ggggbB..', '.ggggGbBtt', 'gkgGPGg...', '.gppggbB...', '...g..g....'], colors: PIGEON },
  pigeon_up: { rows: ['....bb....', '..gggb....', '.gkgGPGg..', 'gkgggGbB..', '.gppgg.....'], colors: PIGEON },
  pigeon_down: { rows: ['..ggg.....', '.ggggbB...', 'gkgGPGg...', '.gppggbB..', '....bb....'], colors: PIGEON },
  gull: { rows: ['..www.....', '.wwwww....', 'gkwyyw....', '.gwwwwg...', '..gwwg.....', '..wwww.....', '...g.g.....'], colors: GULL },
  gull_peck: { rows: ['..........', '.....y....', '..wwwwg...', '.gkwyyw....', '..gwwww....', '...wwww....', '...g..g....'], colors: GULL },
  gull_up: { rows: ['....gg....', '..gwwg....', '.gkwyyw...', 'gwwwwwwg..', '..gwwg.....'], colors: GULL },
  gull_down: { rows: ['..gwwg.....', '.gwwwwg....', 'gkwyyw.....', '.gwwwwg....', '....gg.....'], colors: GULL },
  crow: { rows: ['..kkk.....', '.kkkkk....', 'kkbkbb....', '.kkkbbg...', '..kbbbkk...', '...kkkk....', '...k..k....'], colors: CROW },
  crow_peck: { rows: ['..........', '.....b....', '..kkkbb....', '.kkbkbbg...', 'kkkbbg.....', '.kkkkk.....', '...k..k....'], colors: CROW },
  crow_up: { rows: ['....bb....', '..kkbkk...', '.kkbkbb....', 'kkkbbgk....', '.kkkbb.....'], colors: CROW },
  crow_down: { rows: ['..kkk.....', '.kkbkbb....', 'kkkbbgk....', '.kkkkk.....', '....bb.....'], colors: CROW },
  wing: { rows: ['##.##', '##b##', '.#.#.'], colors: { b: '#3a2a20' } },
};

type Sway = { obj: Phaser.GameObjects.Image; phase: number; amp: number };
type BirdSpecies = 'sparrow' | 'pigeon' | 'gull' | 'crow';
type Flock = { area: MapAmbient; center: Vec; species: BirdSpecies; params: SpeciesParams; birds: Bird[]; lastFlush: number; chirpIn: number };
type Bird = {
  img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; flock: Flock;
  species: BirdSpecies; bold: boolean; state: 'ground' | 'hopping' | 'flush_pending' | 'away';
  next: number; alertFor: number; alerted: boolean; pecking: boolean;
  hopsLeft: number; hopVector: Vec; phase: number; mode: 'escape' | 'curious' | null;
};
const BIRD_CONFIG: Record<BirdSpecies, {
  params: SpeciesParams; scale: number; flightDistance: [number, number]; flightMs: [number, number];
  relandMs: [number, number]; slow: boolean; walker: boolean; sideHop: boolean; glider: boolean;
}> = {
  sparrow: { params: SPARROW_PARAMS, scale: 1.5, flightDistance: [380, 480], flightMs: [1100, 1300], relandMs: [7000, 12000], slow: false, walker: false, sideHop: false, glider: false },
  pigeon: { params: { catRadius: 150, runRadius: 150, panicRadius: 55, walkRadius: 80 }, scale: 1.8, flightDistance: [170, 260], flightMs: [850, 1100], relandMs: [3500, 6500], slow: false, walker: true, sideHop: false, glider: false },
  gull: { params: { catRadius: 150, runRadius: 190, panicRadius: 55, walkRadius: 90 }, scale: 2, flightDistance: [340, 440], flightMs: [1300, 1700], relandMs: [6000, 9500], slow: true, walker: false, sideHop: false, glider: true },
  crow: { params: { catRadius: 150, runRadius: 230, panicRadius: 55, walkRadius: 140 }, scale: 1.8, flightDistance: [420, 560], flightMs: [1250, 1650], relandMs: [6500, 10000], slow: false, walker: false, sideHop: true, glider: false },
};
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
  private flocks: Flock[] = [];
  private flies: Fly[] = [];
  private pools: Pool[] = [];
  private t = 0;
  private pixels: ImageData;
  private k: number;

  constructor(
    private scene: Phaser.Scene,
    bgKey: string,
    mapWidth: number,
    specs: MapAmbient[],
    private flag: (name: string) => boolean = () => false,
    private sound: (id: string, options?: { volume?: number; detune?: number }) => boolean = () => false,
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
    const key = `amb:pool:${a.x}:${a.y}`;
    const cover = (this.scene.textures.exists(key) ? this.scene.textures.get(key) : this.scene.textures.createCanvas(key, w, h)) as Phaser.Textures.CanvasTexture;
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

  private flock(area: MapAmbient, n: number) {
    const requested = area.props.species as BirdSpecies | undefined;
    const species = requested && requested in BIRD_CONFIG ? requested : 'sparrow';
    const config = BIRD_CONFIG[species];
    const center = this.spot(area);
    const flock: Flock = { area, species, params: config.params, birds: [], center, lastFlush: -Infinity, chirpIn: rand(3000, 9000) };
    this.flocks.push(flock);
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(center.x + rand(-60, 60), area.x, area.x + area.width);
      const y = Phaser.Math.Clamp(center.y + rand(-24, 24), area.y, area.y + area.height);
      const shadow = this.keep(this.scene.add.image(x, y, 'amb:shadow').setOrigin(0.5, 0.5).setScale(config.scale).setAlpha(0.22).setDepth(y - 1));
      const img = this.keep(this.scene.add.image(x, y, `amb:${species}`).setOrigin(0.5, 1).setScale(config.scale).setDepth(y).setFlipX(Math.random() < 0.5));
      const bird: Bird = {
        img, shadow, flock, species, bold: Math.random() < 0.25, state: 'ground', next: rand(300, config.slow ? 2600 : 1500),
        alertFor: 0, alerted: false, pecking: false, hopsLeft: 0, hopVector: { x: 0, y: 0 },
        phase: rand(0, Math.PI * 2), mode: null,
      };
      this.birds.push(bird);
      flock.birds.push(bird);
    }
  }

  scare(player?: Vec) {
    for (const flock of this.flocks) {
      const active = flock.birds.filter((b) => b.state === 'ground' || b.state === 'hopping');
      if (!active.length) continue;
      const origin = active.reduce((p, b) => ({ x: p.x + b.img.x / active.length, y: p.y + b.img.y / active.length }), { x: 0, y: 0 });
      this.playFlushSound(flock, player ?? origin);
      for (const b of active) {
        const angle = Math.atan2(b.img.y - origin.y, b.img.x - origin.x) + rand(-0.44, 0.44);
        this.scheduleTakeOff(b, angle, rand(0, 260));
      }
    }
  }

  private playFlushSound(flock: Flock, player: Vec) {
    const distance = Math.min(...flock.birds.map((b) => Math.hypot(b.img.x - player.x, b.img.y - player.y)));
    const volume = distance <= 150 ? 1 : distance >= 600 ? 0 : 1 - (distance - 150) / 450;
    if (volume <= 0 || this.t - flock.lastFlush < 0.8) return;
    flock.lastFlush = this.t;
    const options = { volume, detune: Math.round(rand(-200, 200)) };
    const id = `${flock.species}_flush_${Math.floor(rand(1, 4))}`;
    if (!this.sound(id, options)) this.sound('sparrow_flush', options);
  }

  private playChirp(b: Bird, player: Vec, multiplier = 1) {
    const distance = Math.hypot(b.img.x - player.x, b.img.y - player.y);
    const volume = 0.42 * Math.max(0, 1 - distance / 500) * multiplier;
    if (volume <= 0) return;
    this.sound(`${b.species}_chirp_${Math.floor(rand(1, 4))}`, { volume });
  }

  private startFlush(b: Bird, threat: Vec, player: Vec) {
    const flock = b.flock;
    this.playFlushSound(flock, player);
    const neighbors = flock.birds.filter((o) =>
      (o.state === 'ground' || o.state === 'hopping') && Math.hypot(o.img.x - b.img.x, o.img.y - b.img.y) < 160,
    );
    if (!neighbors.includes(b)) neighbors.unshift(b);
    for (const [i, bird] of neighbors.entries()) {
      const base = Math.atan2(bird.img.y - threat.y, bird.img.x - threat.x);
      const angle = base + rand(-0.44, 0.44);
      this.scheduleTakeOff(bird, angle, i === 0 ? 0 : rand(0, 260));
    }
  }

  private scheduleTakeOff(b: Bird, angle: number, delay: number) {
    if (b.state !== 'ground' && b.state !== 'hopping') return;
    this.scene.tweens.killTweensOf(b.img);
    this.scene.tweens.killTweensOf(b.shadow);
    b.state = 'flush_pending';
    b.mode = null;
    b.pecking = false;
    this.timers.push(this.scene.time.delayedCall(delay, () => {
      if (b.state === 'flush_pending') this.takeOff(b, angle);
    }));
  }

  private takeOff(b: Bird, angle: number) {
    const config = BIRD_CONFIG[b.species];
    const distance = rand(...config.flightDistance);
    const duration = rand(...config.flightMs);
    const to = {
      x: b.img.x + Math.cos(angle) * distance,
      y: b.img.y + Math.sin(angle) * distance - rand(90, 190),
    };
    b.state = 'away';
    b.next = rand(...config.relandMs);
    b.shadow.setVisible(false);
    b.img.setFlipX(Math.cos(angle) > 0).setDepth(4000);
    this.scene.tweens.add({
      targets: b.img, x: to.x, y: to.y, duration, ease: 'Sine.easeIn',
      onUpdate: () => {
        const flap = Math.floor(this.t * (config.glider ? 4 : 14));
        b.img.setTexture(`amb:${b.species}_${flap % (config.glider ? 4 : 2) === 0 ? 'up' : 'down'}`);
        b.img.y += Math.sin(this.t * 8 + b.phase) * 2;
      },
      onComplete: () => b.img.setVisible(false),
    });
  }

  private land(b: Bird, player: Vec) {
    const { area } = b.flock;
    let p = this.spot(area);
    for (let i = 0; i < 6 && Math.hypot(p.x - player.x, p.y - player.y) < 260; i++) p = this.spot(area);
    b.next = Infinity;
    b.img.setPosition(p.x, p.y - 220).setVisible(true).setDepth(4000);
    b.img.setFlipX(b.img.x < p.x);
    this.scene.tweens.add({
      targets: b.img, x: p.x, y: p.y, duration: 1000, ease: 'Sine.easeOut',
      onUpdate: () => {
        const flap = Math.floor(this.t * 12);
        b.img.setTexture(`amb:${b.species}_${flap % 2 ? 'up' : 'down'}`);
      },
      onComplete: () => {
        b.state = 'ground';
        b.next = rand(800, 2000);
        b.alertFor = 0;
        b.alerted = false;
        b.img.setTexture(`amb:${b.species}`).setDepth(p.y);
        b.shadow.setPosition(p.x, p.y).setDepth(p.y - 1).setVisible(true);
      },
    });
  }

  private peck(b: Bird) {
    if (b.state !== 'ground') return;
    b.pecking = true;
    b.img.setTexture(`amb:${b.species}_peck`);
    this.timers.push(this.scene.time.delayedCall(220, () => {
      if (b.state !== 'ground' || !b.pecking) return;
      b.pecking = false;
      b.img.setTexture(`amb:${b.species}`);
    }));
  }

  private hopAway(b: Bird, away: Vec) {
    b.alertFor = 0;
    b.alerted = false;
    const length = Math.hypot(away.x, away.y) || 1;
    b.mode = 'escape';
    b.hopsLeft = Math.floor(rand(2, 4));
    b.hopVector = { x: away.x / length, y: away.y / length };
    this.escapeHop(b);
  }

  private escapeHop(b: Bird) {
    const config = BIRD_CONFIG[b.species];
    const area = b.flock.area;
    const dx = config.sideHop ? Math.sign(b.hopVector.x || (Math.random() < 0.5 ? -1 : 1)) * rand(24, 38) : b.hopVector.x * rand(24, 38);
    const dy = config.walker ? b.hopVector.y * rand(2, 8) : b.hopVector.y * rand(18, 30);
    const to = {
      x: Phaser.Math.Clamp(b.img.x + dx, area.x, area.x + area.width),
      y: Phaser.Math.Clamp(b.img.y + dy, area.y, area.y + area.height),
    };
    this.hopTo(b, to, config.walker ? 0 : config.sideHop ? 10 : 7, config.walker ? 220 : 150, () => {
      b.hopsLeft--;
      if (b.mode === 'escape' && b.hopsLeft > 0) this.escapeHop(b);
      else {
        b.state = 'ground';
        b.mode = null;
        b.next = rand(400, 1200);
      }
    });
  }

  private hopTo(b: Bird, to: Vec, lift: number, duration: number, done: () => void) {
    b.state = 'hopping';
    b.pecking = false;
    b.img.setTexture(`amb:${b.species}`);
    b.img.setFlipX(to.x > b.img.x);
    this.scene.tweens.killTweensOf(b.img);
    const shadowTarget = { x: to.x, y: to.y };
    this.scene.tweens.add({ targets: b.shadow, x: shadowTarget.x, y: shadowTarget.y, duration });
    this.scene.tweens.add({
      targets: b.img, x: to.x, y: to.y - lift, duration: duration / 2, ease: 'Sine.easeOut',
      onComplete: () => this.scene.tweens.add({
        targets: b.img, y: to.y, duration: duration / 2, ease: 'Sine.easeIn',
        onComplete: () => {
          b.img.setDepth(to.y);
          b.shadow.setPosition(to.x, to.y).setDepth(to.y - 1);
          done();
        },
      }),
    });
  }

  private curiousHop(b: Bird, player: Vec) {
    const dx = player.x - b.img.x, dy = player.y - b.img.y;
    const distance = Math.hypot(dx, dy) || 1;
    const step = Math.min(34, distance - 70);
    if (step <= 0) return;
    this.hopTo(b, {
      x: Phaser.Math.Clamp(b.img.x + (dx / distance) * step, b.flock.area.x, b.flock.area.x + b.flock.area.width),
      y: Phaser.Math.Clamp(b.img.y + (dy / distance) * step, b.flock.area.y, b.flock.area.y + b.flock.area.height),
    }, BIRD_CONFIG[b.species].walker ? 0 : 7, 180, () => {
      b.state = 'ground';
      if (Math.hypot(b.img.x - player.x, b.img.y - player.y) <= 70) this.peck(b);
      else b.next = 0;
    });
  }

  private tickBird(b: Bird, dt: number, player: { pos: Vec; speed: number; stillFor: number }, cat?: Vec) {
    if (b.state === 'away') {
      if (Number.isFinite(b.next)) {
        b.next -= dt;
        if (b.next <= 0) this.land(b, player.pos);
      }
      return;
    }
    if (b.state === 'flush_pending' || b.state === 'hopping' || !b.img.visible) return;
    const distance = Math.hypot(b.img.x - player.pos.x, b.img.y - player.pos.y);
    const catDistance = cat ? Math.hypot(b.img.x - cat.x, b.img.y - cat.y) : Infinity;
    if (player.speed > 0 && distance < b.flock.params.walkRadius) b.alertFor += dt;
    else {
      b.alertFor = 0;
      b.alerted = false;
    }
    const reaction = birdReaction({
      distance, playerSpeed: player.speed, stillFor: player.stillFor, catDistance,
      bold: b.bold, alertFor: b.alertFor, species: b.flock.params,
    });
    if (reaction === 'flush') return this.startFlush(b, cat && catDistance < b.flock.params.catRadius ? cat : player.pos, player.pos);
    if (reaction === 'alert') {
      b.pecking = false;
      b.img.setTexture(`amb:${b.species}`).setFlipX(player.pos.x > b.img.x);
      if (!b.alerted) {
        b.alerted = true;
        this.playChirp(b, player.pos, 0.6);
        this.scene.tweens.add({ targets: b.img, y: b.img.y - 2, duration: 90, yoyo: true, repeat: 1 });
      }
      return;
    }
    if (reaction === 'hop_away') {
      return this.hopAway(b, { x: b.img.x - player.pos.x, y: b.img.y - player.pos.y });
    }
    if (reaction === 'curious') return this.curiousHop(b, player.pos);
    b.alerted = false;
    b.alertFor = 0;
    b.next -= dt;
    if (b.next > 0) return;
    const config = BIRD_CONFIG[b.species];
    b.next = rand(config.slow ? 1400 : 350, config.slow ? 3200 : 1600);
    const roll = Math.random();
    if (roll < 0.45) this.peck(b);
    else if (roll < 0.6) b.img.setFlipX(!b.img.flipX);
    else {
      const sign = b.img.flipX ? 1 : -1;
      const dx = sign * rand(config.walker ? 18 : 10, config.walker ? 32 : 22);
      const toX = Phaser.Math.Clamp(b.img.x + dx, b.flock.area.x, b.flock.area.x + b.flock.area.width);
      const y = Phaser.Math.Clamp(b.img.y + rand(-6, 6), b.flock.area.y, b.flock.area.y + b.flock.area.height);
      if (config.walker) {
        b.img.setFlipX(dx > 0);
        this.scene.tweens.add({ targets: b.img, x: toX, y: y - 2, duration: 360, yoyo: true, onComplete: () => b.img.setY(y) });
        this.scene.tweens.add({ targets: b.shadow, x: toX, y, duration: 360, yoyo: true });
      } else {
        this.hopTo(b, { x: toX, y }, config.sideHop ? 10 : 7, 160, () => { b.state = 'ground'; });
      }
    }
  }

  private tickFlock(flock: Flock, dt: number, player: { pos: Vec }) {
    flock.chirpIn -= dt;
    if (flock.chirpIn > 0) return;
    flock.chirpIn = rand(3000, 9000);
    if (Math.hypot(flock.center.x - player.pos.x, flock.center.y - player.pos.y) > 500) return;
    const bird = pick(flock.birds);
    if (bird) this.playChirp(bird, player.pos);
  }

  private butterfly(area: MapAmbient) {
    const p = this.spot(area);
    const img = this.keep(this.scene.add.image(p.x, p.y, 'amb:wing').setTint(pick([0xffffff, 0xfff1a0, 0xffd0e8])).setDepth(4000));
    this.flies.push({ img, area, target: this.spot(area), phase: rand(0, 10) });
  }

  update(dt: number, player: { pos: Vec; speed: number; stillFor: number }, cat?: Vec) {
    this.t += dt / 1000;
    const t = this.t;
    for (const s of this.sway) {
      const gust = Math.max(0, Math.sin(t * 0.7 - s.obj.x * 0.004));
      s.obj.setAngle(s.amp * (0.3 * Math.sin(t * 2.1 + s.phase) + 0.9 * gust * gust));
    }
    for (const flock of this.flocks) this.tickFlock(flock, dt, player);
    for (const b of this.birds) this.tickBird(b, dt, player, cat);
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
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = [];
    this.sway = [];
    this.birds = [];
    this.flocks = [];
    this.flies = [];
    this.pools = [];
  }
}
