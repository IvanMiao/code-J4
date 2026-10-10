import Phaser from 'phaser';
import storyJson from '../../../content/story/main.ink';
import { cast, encounters, FONT, items, maps, params, START, type AudioIndex } from '../config.ts';
import { Actor } from '../Actor.ts';
import { Ambient } from '../Ambient.ts';
import { DialogueBox } from '../ui/DialogueBox.ts';
import { ChoiceMenu } from '../ui/ChoiceMenu.ts';
import type { BattleData } from './Battle.ts';
import { speakerResolver } from '../../engine/content.ts';
import { inRect, type MapTrigger } from '../../engine/map.ts';
import { addItem, readSave, writeSave, type ActorState } from '../../engine/save.ts';
import { DIRS, type Dir } from '../../story/commands.ts';
import type { CommandEvent, LineEvent } from '../../story/parse.ts';
import { StoryRunner, type StoryHost } from '../../story/runner.ts';
import { facingOf, facingVec, step, type Vec, REACH } from '../../engine/walk.ts';

const PLAYER = 'linxia';
const WALK_SPEED = 190;
const speakerOf = speakerResolver(cast);

type Target = { actor?: Actor; trigger?: MapTrigger; knot: string; at: Vec };

export class FieldScene extends Phaser.Scene implements StoryHost {
  runner = new StoryRunner(storyJson, speakerOf);
  inventory: Record<string, number> = {};
  introDone = false;
  private actors = new Map<string, Actor>();
  private player!: Actor;
  private dialogue!: DialogueBox;
  private choices!: ChoiceMenu;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hint!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private loops: Partial<Record<'bgm' | 'ambience', Phaser.Sound.BaseSound>> = {};
  private voice?: Phaser.Sound.BaseSound;
  private loopIds: Partial<Record<'bgm' | 'ambience', string>> = {};
  private inBattle = false;
  private changing = false;
  private mapId = START.map;
  private mapState: Record<string, Record<string, ActorState>> = {};
  private bg!: Phaser.GameObjects.Image;
  private fg: Phaser.GameObjects.Image[] = [];
  private ambient?: Ambient;
  private areaLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('field');
  }

  get busy() {
    return this.runner.running || this.choices.open || this.inBattle || this.changing;
  }

  get map() {
    return maps[this.mapId];
  }

  create() {
    this.bg = this.add.image(0, 0, `bg:${this.mapId}`).setOrigin(0).setDepth(-1);
    this.player = this.spawn(PLAYER, { x: 0, y: 0 });

    this.dialogue = new DialogueBox(this);
    this.choices = new ChoiceMenu(this);
    this.hint = this.add.text(0, 0, '空格', { fontFamily: FONT, fontSize: '12px', color: '#1a120a', backgroundColor: '#e6c77a', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1).setDepth(9_000).setVisible(false);
    this.toastText = this.add.text(480, 24, '', { fontFamily: FONT, fontSize: '24px', color: '#ffe7a3', backgroundColor: '#131b2fe6', padding: { x: 14, y: 8 } })
      .setOrigin(0.5, 0).setDepth(10_200).setAlpha(0).setScrollFactor(0);
    this.add.text(10, 520, '方向键/WASD 移动 · 空格/Enter 交谈 · Esc 菜单', { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setDepth(9_500).setScrollFactor(0);
    this.areaLabel = this.add.text(950, 10, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0).setDepth(9_500).setScrollFactor(0);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.placeMap(params.get('map') ?? START.map, START.anchor);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    for (const k of ['SPACE', 'ENTER', 'Z']) kb.on(`keydown-${k}`, () => this.confirm());
    kb.on('keydown-UP', () => this.choices.move(-1));
    kb.on('keydown-DOWN', () => this.choices.move(1));
    kb.on('keydown-ESC', () => this.systemMenu());
    this.input.on('pointerdown', () => this.dialogue.open && !this.choices.open && this.dialogue.confirm());

    import.meta.hot?.accept('../../../content/story/main.ink', (mod) => mod && this.reloadStory(mod.default));
    (window as any).__field = this;
    this.boot();
  }

  update(_t: number, dt: number) {
    this.ambient?.update(dt, this.player.pos);
    if (this.busy) {
      this.hint.setVisible(false);
      return;
    }
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (dx || dy) {
      const len = Math.hypot(dx, dy), d = (WALK_SPEED * dt) / 1000;
      this.player.face = facingOf(dx, dy, this.player.face);
      this.player.setPos(step(this.player.pos, { x: (dx / len) * d, y: (dy / len) * d }, this.map.walkable, this.map.blocked));
      this.player.setMoving(true);
      const exit = this.map.exits.find((e) => inRect(this.player.pos, e));
      if (exit) return void this.travel(exit.map, exit.anchor);
    } else {
      this.player.setMoving(false);
    }
    const t = this.target();
    this.hint.setVisible(!!t && !t.trigger?.hidden);
    if (t) this.hint.setPosition(t.at.x, t.at.y);
  }

  // ---------- StoryHost ----------

  async line(e: LineEvent) {
    const member = e.speaker ? cast[e.speaker] : null;
    const vo = e.voiced && e.lineId ? `vo:${e.lineId}` : null;
    this.voice?.stop();
    if (vo && this.cache.audio.exists(vo)) {
      this.voice = this.sound.add(vo);
      this.voice.play();
    } else if (member?.meows) {
      this.sfx(member.meows[e.emotion ?? member.default] ?? Object.values(member.meows)[0]);
    }
    await this.dialogue.show(e);
  }

  async choose(options: string[]) {
    return this.choices.show(options);
  }

  async command(c: CommandEvent): Promise<string | void> {
    const [a0, a1] = c.args;
    const num = (v: string | undefined, d: number) => (v === undefined ? d : Number(v));
    switch (c.name) {
      case 'bgm':
      case 'ambience':
        return this.loop(c.name, a0, num(c.options.fade, 1));
      case 'sfx':
        return this.sfx(a0);
      case 'wait':
        return this.delay(num(a0, 0.5) * 1000);
      case 'fade':
        return this.fade(a0 === 'out', num(c.options.time, 0.6) * 1000);
      case 'scare':
        this.ambient?.scare();
        return;
      case 'shake':
        this.cameras.main.shake(num(c.options.time, 0.3) * 1000, num(c.options.strength, 0.01));
        return this.delay(num(c.options.time, 0.3) * 1000);
      case 'walk': {
        this.dialogue.hide();
        const to = this.map.anchors[c.options.to];
        if (to) await this.actor(a0).walkTo(to, num(c.options.speed, 120));
        return;
      }
      case 'face': {
        const who = this.actor(a0);
        if ((DIRS as readonly string[]).includes(a1)) who.setFace(a1 as Dir);
        else who.faceToward(this.actors.get(a1)?.pos ?? this.map.anchors[a1]);
        return;
      }
      case 'emote':
        return this.emote(this.actor(a0), a1);
      case 'show': {
        const who = this.actors.get(a0) ?? this.spawn(a0, this.map.anchors[c.options.at]);
        if (c.options.at) who.setPos(this.map.anchors[c.options.at]);
        if (c.options.face) who.setFace(c.options.face as Dir);
        who.sprite.setVisible(true);
        return;
      }
      case 'hide':
        this.actors.get(a0)?.sprite.setVisible(false);
        return;
      case 'give':
      case 'take': {
        const n = num(c.options.n, 1) * (c.name === 'give' ? 1 : -1);
        addItem(this.inventory, a0, n);
        this.toast(`${n > 0 ? '获得' : '失去'}　${items[a0]?.name ?? a0}${Math.abs(n) > 1 ? ` ×${Math.abs(n)}` : ''}`);
        return;
      }
      case 'battle':
        return this.battle(a0);
      default:
        console.warn(`[story] unknown command @${c.name}`);
    }
  }

  // ---------- flow ----------

  private boot() {
    const slot = params.get('load');
    const start = params.get('start');
    if (slot !== null && this.loadGame(Number(slot))) return;
    for (const pair of (params.get('set') ?? '').split(',').filter(Boolean)) {
      const [k, v] = pair.split(':');
      this.runner.restoreVariables({ [k]: v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v) });
    }
    if (start && this.runner.hasKnot(start)) {
      this.introDone = true;
      this.run(start);
    } else {
      this.run('intro').then(() => (this.introDone = true));
    }
  }

  private async run(knot: string) {
    await this.runner.play(knot, this);
    this.dialogue.hide();
  }

  private confirm() {
    if (this.choices.open) return this.choices.confirm();
    if (this.dialogue.open) return this.dialogue.confirm();
    if (this.busy) return;
    const t = this.target();
    if (!t) return;
    if (t.actor) {
      t.actor.faceToward(this.player.pos);
      this.player.faceToward(t.actor.pos);
    }
    this.player.setMoving(false);
    this.run(t.knot);
  }

  private target(): Target | null {
    const p = this.player.pos;
    const f = facingVec(this.player.face);
    const probe = { x: p.x + f.x * REACH, y: p.y + f.y * REACH };
    for (const a of this.actors.values()) {
      const knot = this.map.actors.find((m) => m.id === a.id)?.knot;
      if (a === this.player || !knot || !a.sprite.visible) continue;
      if (Math.hypot(probe.x - a.pos.x, probe.y - a.pos.y) < 50) return { actor: a, knot, at: { x: a.pos.x, y: a.pos.y - a.height - 4 } };
    }
    for (const t of this.map.triggers) {
      const hit = t.face ? t.face === this.player.face && inRect(probe, t) : inRect(probe, t) || inRect(p, t);
      if (hit) return { trigger: t, knot: t.knot, at: { x: t.x + t.width / 2, y: t.y } };
    }
    return null;
  }

  private async systemMenu() {
    if (this.busy) return;
    const pick = await this.choices.show(['存档', '读档', '返回'], { x: 360, y: 150, title: '菜单' });
    if (pick === 0) {
      this.saveGame(1);
      this.toast('已存档');
    } else if (pick === 1) {
      this.toast(this.loadGame(1) ? '已读档' : '没有存档');
    }
  }

  /** Walk-off exit: fade, swap map, fade back. */
  private async travel(map: string, anchor: string) {
    this.changing = true;
    this.player.setMoving(false);
    await this.fade(true, 250);
    this.placeMap(map, anchor);
    await this.fade(false, 250);
    this.changing = false;
    this.toast(this.map.title);
  }

  /** Copies a polygon of the current background into its own image drawn above actors standing behind `baseline`. */
  private cutout(key: string, poly: Vec[], baseline: number) {
    const src = this.textures.get(`bg:${this.mapId}`).getSourceImage() as HTMLImageElement;
    const k = src.width / this.map.width;
    const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
    const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys));
    if (!this.textures.exists(key)) {
      const w = Math.ceil(Math.max(...xs)) - x0, h = Math.ceil(Math.max(...ys)) - y0;
      const tex = this.textures.createCanvas(key, Math.ceil(w * k), Math.ceil(h * k))!;
      const ctx = tex.context;
      ctx.imageSmoothingEnabled = false;
      ctx.beginPath();
      poly.forEach((p, i) => (i ? ctx.lineTo((p.x - x0) * k, (p.y - y0) * k) : ctx.moveTo((p.x - x0) * k, (p.y - y0) * k)));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(src, -x0 * k, -y0 * k);
      tex.refresh();
    }
    return this.add.image(x0, y0, key).setOrigin(0).setScale(1 / k).setDepth(baseline);
  }

  /** Swaps background, actors, camera bounds and audio to `id`; puts the player on `anchor` if given. */
  private placeMap(id: string, anchor: string | null, remember = true) {
    const here: Record<string, ActorState> = {};
    for (const [aid, a] of this.actors) {
      if (a === this.player) continue;
      here[aid] = { ...a.pos, face: a.face, visible: a.sprite.visible };
      a.sprite.destroy();
      this.actors.delete(aid);
    }
    if (remember) this.mapState[this.mapId] = here;
    this.mapId = maps[id] ? id : START.map;
    const m = this.map;
    this.bg.setTexture(`bg:${this.mapId}`).setDisplaySize(m.width, m.height);
    for (const f of this.fg) f.destroy();
    this.fg = m.foreground.map((f, i) => this.cutout(`fg:${this.mapId}:${i}`, f.polygon, f.baseline));
    this.ambient?.destroy();
    this.ambient = new Ambient(this, `bg:${this.mapId}`, m.width, m.ambient, (v) => !!this.runner.variables()[v]);
    for (const a of m.actors) {
      const saved = this.mapState[this.mapId]?.[a.id];
      const actor = this.spawn(a.id, saved ?? a);
      actor.setFace((saved?.face ?? a.face) as Dir);
      if (saved) actor.sprite.setVisible(saved.visible);
    }
    if (anchor !== null) this.player.setPos(m.anchors[anchor] ?? Object.values(m.anchors)[0]);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, m.width, m.height);
    cam.centerOn(this.player.pos.x, this.player.pos.y);
    if (m.bgm) this.loop('bgm', m.bgm, 1);
    if (m.ambience) this.loop('ambience', m.ambience, 1);
    this.areaLabel.setText(m.title);
  }

  saveGame(slot: number) {
    const actors: Record<string, ActorState> = {};
    for (const [id, a] of this.actors) actors[id] = { ...a.pos, face: a.face, visible: a.sprite.visible };
    return writeSave(localStorage, slot, { map: this.mapId, maps: { ...this.mapState, [this.mapId]: {} }, actors, inventory: { ...this.inventory }, ink: this.runner.saveState(), introDone: this.introDone });
  }

  loadGame(slot: number): boolean {
    const data = readSave(localStorage, slot);
    if (!data) return false;
    this.mapState = { ...(data.maps ?? {}) };
    this.placeMap(data.map, null, false);
    for (const [id, s] of Object.entries(data.actors)) {
      const a = this.actors.get(id) ?? this.spawn(id, s);
      a.setPos(s);
      a.setFace(s.face);
      a.sprite.setVisible(s.visible);
    }
    this.inventory = { ...data.inventory };
    this.runner.loadState(data.ink);
    this.introDone = data.introDone;
    return true;
  }

  private reloadStory(json: object) {
    const vars = this.runner.variables();
    this.runner = new StoryRunner(json, speakerOf);
    this.runner.restoreVariables(vars);
    this.toast('剧本已热更新');
    const start = params.get('start');
    if (start && this.runner.hasKnot(start) && !this.busy) this.run(start);
  }

  // ---------- helpers ----------

  private spawn(id: string, at: Vec): Actor {
    const a = new Actor(this, id, at.x, at.y);
    this.actors.set(id, a);
    return a;
  }

  private actor(id: string): Actor {
    const a = this.actors.get(id);
    if (!a) throw new Error(`actor ${id} is not on this map`);
    return a;
  }

  private delay(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  private fade(out: boolean, ms: number) {
    const cam = this.cameras.main;
    return new Promise<void>((r) => {
      cam.once(out ? 'camerafadeoutcomplete' : 'camerafadeincomplete', () => r());
      out ? cam.fadeOut(Math.max(1, ms)) : cam.fadeIn(Math.max(1, ms));
    });
  }

  private sfx(id: string | undefined) {
    if (id && this.cache.audio.exists(`sfx:${id}`)) this.sound.play(`sfx:${id}`, { volume: 0.7 });
  }

  private loop(kind: 'bgm' | 'ambience', id: string, fade: number) {
    if (this.loopIds[kind] === id) return;
    this.loopIds[kind] = id;
    const old = this.loops[kind];
    if (old) this.tweens.add({ targets: old, volume: 0, duration: fade * 1000, onComplete: () => old.destroy() });
    this.loops[kind] = undefined;
    const key = `${kind}:${id}`;
    if (id === 'stop' || !this.cache.audio.exists(key)) return;
    const s = this.sound.add(key, { loop: true, volume: 0 });
    s.play();
    this.tweens.add({ targets: s, volume: kind === 'bgm' ? 0.45 : 0.35, duration: Math.max(1, fade * 1000) });
    this.loops[kind] = s;
  }

  private async emote(a: Actor, symbol: string) {
    const t = this.add.text(a.pos.x, a.pos.y - a.height - 6, symbol, {
      fontFamily: FONT, fontSize: '24px', color: '#1a120a', backgroundColor: '#f4ead2', padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 1).setDepth(9_100).setScale(0);
    await new Promise<void>((r) => this.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.Out', onComplete: () => r() }));
    await this.delay(650);
    t.destroy();
  }

  private toast(msg: string) {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1400, duration: 400 });
  }

  private battle(id: string): Promise<string> {
    const encounter = encounters[id];
    if (!encounter) return Promise.resolve('win');
    this.dialogue.hide();
    this.inBattle = true;
    return new Promise((resolve) => {
      const data: BattleData = {
        encounter,
        done: (result) => {
          this.inBattle = false;
          resolve(result);
        },
      };
      this.scene.launch('battle', data);
    });
  }
}

export type { AudioIndex };
