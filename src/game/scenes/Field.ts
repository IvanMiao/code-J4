import Phaser from 'phaser';
import storyJson from '../../../content/story/main.ink';
import { cast, encounters, FONT, HANDS, HEIGHT, items, maps, params, START, style, WIDTH, type AudioIndex } from '../config.ts';
import { Actor } from '../Actor.ts';
import { Ambient } from '../Ambient.ts';
import { DialogueBox } from '../ui/DialogueBox.ts';
import { ChoiceMenu } from '../ui/ChoiceMenu.ts';
import { SpeechBubble } from '../ui/SpeechBubble.ts';
import type { BattleData } from './Battle.ts';
import { speakerResolver } from '../../engine/content.ts';
import { exitEdge, inRect, type MapExit, type MapTrigger } from '../../engine/map.ts';
import { addItem, readSave, writeSave, type ActorState } from '../../engine/save.ts';
import { DIRS, type Dir } from '../../story/commands.ts';
import type { CommandEvent, LineEvent } from '../../story/parse.ts';
import { StoryRunner, type StoryHost } from '../../story/runner.ts';
import { facingOf, facingVec, sideFacing, step, type Vec, REACH } from '../../engine/walk.ts';
import { UI_STRINGS } from '../ui/strings.ts';

const WALK_SPEED = 250;
const RUN_SPEED = 420;
const ACCELERATION = 2400;
const speakerOf = speakerResolver(cast);

type Target = { key: string; actor?: Actor; trigger?: MapTrigger; knot: string; at: Vec; icon: string };
export class FieldScene extends Phaser.Scene implements StoryHost {
  runner = new StoryRunner(storyJson, speakerOf);
  inventory: Record<string, number> = {};
  introDone = false;
  private actors = new Map<string, Actor>();
  private player!: Actor;
  private dialogue!: DialogueBox | SpeechBubble;
  private dialogueBox!: DialogueBox;
  private speechBubble!: SpeechBubble;
  private choices!: ChoiceMenu;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hintRoot!: Phaser.GameObjects.Container;
  private hintBob!: Phaser.GameObjects.Container;
  private hintBubble!: Phaser.GameObjects.Image;
  private hintKeyFrame!: Phaser.GameObjects.Graphics;
  private hintKeyText!: Phaser.GameObjects.Text;
  private hintTargetKey = '';
  private hintCurrentKey = '';
  private hintTransition = 0;
  private exitCue!: Phaser.GameObjects.Container;
  private exitCueGraphics!: Phaser.GameObjects.Graphics;
  private exitCueText!: Phaser.GameObjects.Text;
  private exitCueKey = '';
  private exitCueTransition = 0;
  private toastText!: Phaser.GameObjects.Text;
  private loops: Partial<Record<'bgm' | 'ambience', Phaser.Sound.BaseSound>> = {};
  private voice?: Phaser.Sound.BaseSound;
  private loopIds: Partial<Record<'bgm' | 'ambience', string>> = {};
  private inBattle = false;
  private changing = false;
  private mapId = START.map;
  private mapState: Record<string, Record<string, ActorState>> = {};
  private bg!: Phaser.GameObjects.Image;
  private frameOverlay!: Phaser.GameObjects.Graphics;
  private fg: Phaser.GameObjects.Image[] = [];
  private ambient?: Ambient;
  private areaLabel!: Phaser.GameObjects.Text;
  private controlsLine!: Phaser.GameObjects.Text;
  private currentSpeed = 0;
  private wasBusy = false;
  private lastAmbientPos: Vec | null = null;
  private stillFor = 0;
  private poseFocusId: string | null = null;

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
    this.frameOverlay = this.add.graphics().setScrollFactor(0).setDepth(9_800);
    this.player = this.spawn(this.map.player, { x: 0, y: 0 });
    this.bindPlayerFootsteps(this.player);

    this.dialogueBox = new DialogueBox(this);
    this.speechBubble = new SpeechBubble(this, (id) => this.actors.get(id));
    this.dialogue = this.dialogueBox;
    this.choices = new ChoiceMenu(this);
    this.hintRoot = this.add.container(0, 0).setDepth(9_000).setAlpha(0).setVisible(false);
    this.hintBob = this.add.container(0, 0);
    this.hintBubble = this.add.image(-31, 0, 'hint:look').setOrigin(0.5, 1);
    this.hintKeyFrame = this.add.graphics();
    this.hintKeyFrame.fillStyle(0x1a120a).fillRect(-6, -35, 58, 26);
    this.hintKeyFrame.fillStyle(0xf4ead2).fillRect(-5, -34, 56, 21);
    this.hintKeyFrame.fillStyle(0xfff5dd).fillRect(-4, -33, 54, 2);
    this.hintKeyFrame.fillStyle(0x8c6e3d).fillRect(-5, -13, 56, 3);
    this.hintKeyText = this.add.text(23, -23, '空格', { fontFamily: FONT, fontSize: '12px', color: '#1a120a' }).setOrigin(0.5);
    this.hintBob.add([this.hintBubble, this.hintKeyFrame, this.hintKeyText]);
    this.hintRoot.add(this.hintBob);
    this.exitCue = this.add.container(0, 0).setDepth(9_100).setAlpha(0).setVisible(false).setScrollFactor(0);
    this.exitCueGraphics = this.add.graphics();
    this.exitCueText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '12px', color: '#f4ead2', stroke: '#1a120a', strokeThickness: 3,
    }).setOrigin(0, 0.5);
    this.exitCue.add([this.exitCueGraphics, this.exitCueText]);
    this.toastText = this.add.text(480, 24, '', { fontFamily: FONT, fontSize: '24px', color: '#ffe7a3', backgroundColor: '#131b2fe6', padding: { x: 14, y: 8 } })
      .setOrigin(0.5, 0).setDepth(10_200).setAlpha(0).setScrollFactor(0);
    this.controlsLine = this.add.text(10, 520, UI_STRINGS[this.map.script].controls, { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setDepth(9_500).setScrollFactor(0);
    this.areaLabel = this.add.text(950, 10, '', { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066', padding: { x: 4, y: 2 } })
      .setOrigin(1, 0).setDepth(9_500).setScrollFactor(0);
    this.cameras.main.startFollow(this.player.sprite, true, 0.15, 0.15);
    this.placeMap(params.get('map') ?? START.map, START.anchor);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
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
    const playerPos = this.player.pos;
    for (const actor of this.actors.values()) actor.update(dt);
    const moved = this.lastAmbientPos ? Math.hypot(playerPos.x - this.lastAmbientPos.x, playerPos.y - this.lastAmbientPos.y) : 0;
    const playerSpeed = dt > 0 ? moved * 1000 / dt : 0;
    this.stillFor = moved < 0.5 ? this.stillFor + dt : 0;
    this.lastAmbientPos = { ...playerPos };
    const nika = this.actors.get('nika');
    const cat = nika?.sprite.visible ? nika.pos : undefined;
    this.ambient?.update(dt, { pos: playerPos, speed: playerSpeed, stillFor: this.stillFor }, cat);
    this.updateExitCue();
    if (this.busy) {
      this.currentSpeed = 0;
      if (!this.wasBusy) this.player.setMoving(false);
      this.wasBusy = true;
      this.updateHint(null);
      return;
    }
    this.wasBusy = false;
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (dx || dy) {
      const targetSpeed = k.SHIFT.isDown ? RUN_SPEED : WALK_SPEED;
      const change = (ACCELERATION * dt) / 1000;
      this.currentSpeed = this.currentSpeed < targetSpeed
        ? Math.min(targetSpeed, this.currentSpeed + change)
        : Math.max(targetSpeed, this.currentSpeed - change);
      const len = Math.hypot(dx, dy), d = (this.currentSpeed * dt) / 1000;
      this.player.face = this.map.view === 'side' ? sideFacing(dx, this.player.face) : facingOf(dx, dy, this.player.face);
      this.player.setPos(step(this.player.pos, { x: (dx / len) * d, y: (dy / len) * d }, this.map.walkable, this.map.blocked));
      this.player.setMoving(true, this.currentSpeed / 190);
      const exit = this.map.exits.find((e) => inRect(this.player.pos, e));
      if (exit) {
        this.updateHint(null);
        return void this.travel(exit);
      }
    } else {
      this.currentSpeed = 0;
      this.player.setMoving(false);
    }
    this.updateHint(this.target());
  }

  private bindPlayerFootsteps(actor: Actor) {
    actor.sprite.on('animationupdate', (_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (Number(frame.textureFrame) % 3 !== 1) {
        const sound = Math.floor(Math.random() * 3) + 1;
        this.sfx(`step_${this.map.ground}_${sound}`, { volume: 0.25, detune: Math.round(Math.random() * 300) - 150 });
      }
    });
  }

  // ---------- StoryHost ----------

  async line(e: LineEvent) {
    const member = e.speaker ? cast[e.speaker] : null;
    const speakerActor = e.speaker ? this.actors.get(e.speaker) : undefined;
    speakerActor?.setPoseEngaged(true);
    const vo = e.voiced && e.lineId ? `vo:${e.lineId}` : null;
    this.voice?.stop();
    if (vo && this.cache.audio.exists(vo)) {
      this.voice = this.sound.add(vo);
      this.voice.play();
    } else if (member?.meows) {
      this.sfx(member.meows[e.emotion ?? member.default] ?? Object.values(member.meows)[0]);
    }
    this.speechBubble.setFocusActor(this.poseFocusId);
    await this.dialogue.show(e);
    if (speakerActor?.id !== this.poseFocusId) speakerActor?.setPoseEngaged(false);
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
        this.sfx(a0);
        return;
      case 'wait':
        return this.delay(num(a0, 0.5) * 1000);
      case 'fade':
        return this.fade(a0 === 'out', num(c.options.time, 0.6) * 1000);
      case 'scare':
        this.ambient?.scare(this.player.pos);
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
        this.toast(`${n > 0 ? UI_STRINGS[this.map.script].gained : UI_STRINGS[this.map.script].lost}　${items[a0]?.name ?? a0}${Math.abs(n) > 1 ? ` ×${Math.abs(n)}` : ''}`);
        return;
      }
      case 'battle':
        return this.battle(a0);
      case 'goto':
        return this.travel(a0, a1);
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
      this.run(this.map.intro ?? 'intro').then(() => (this.introDone = true));
    }
  }

  private async run(knot: string) {
    try {
      await this.runner.play(knot, this);
    } finally {
      this.dialogue.hide();
      const focus = this.poseFocusId;
      this.poseFocusId = null;
      if (focus) this.actors.get(focus)?.setPoseEngaged(false);
      this.speechBubble.setFocusActor(null);
    }
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
    if (t.trigger?.sfx) this.sfx(t.trigger.sfx);
    if (t.actor?.isPose) {
      this.poseFocusId = t.actor.id;
      t.actor.setPoseEngaged(true);
    }
    this.run(t.knot);
  }

  private target(): Target | null {
    const p = this.player.pos;
    const f = facingVec(this.player.face);
    const probe = { x: p.x + f.x * REACH, y: p.y + f.y * REACH };
    if (this.map.view === 'side') {
      const above = { x: p.x, y: p.y - REACH };
      for (const a of this.actors.values()) {
        const knot = this.map.actors.find((m) => m.id === a.id)?.knot;
        if (a === this.player || !knot || !a.sprite.visible) continue;
        if (Math.hypot(probe.x - a.pos.x, probe.y - a.pos.y) < 60) {
          return { key: `actor:${a.id}`, actor: a, knot, at: { x: a.pos.x, y: a.pos.y - a.height - 4 }, icon: 'talk' };
        }
      }
      for (const t of this.map.triggers) {
        const faceOk = !t.face || t.face === 'up' || t.face === 'down' || t.face === this.player.face;
        if (faceOk && [p, above, probe].some((point) => inRect(point, t))) {
          return {
            key: `trigger:${t.id}`, trigger: t, actor: t.actor ? this.actors.get(t.actor) : undefined,
            knot: t.knot, at: { x: t.x + t.width / 2, y: t.y }, icon: t.icon ?? 'look',
          };
        }
      }
      return null;
    }
    for (const a of this.actors.values()) {
      const knot = this.map.actors.find((m) => m.id === a.id)?.knot;
      if (a === this.player || !knot || !a.sprite.visible) continue;
      if (Math.hypot(probe.x - a.pos.x, probe.y - a.pos.y) < 50)
        return { key: `actor:${a.id}`, actor: a, knot, at: { x: a.pos.x, y: a.pos.y - a.height - 4 }, icon: 'talk' };
    }
    for (const t of this.map.triggers) {
      const hit = t.face ? t.face === this.player.face && inRect(probe, t) : inRect(probe, t) || inRect(p, t);
      if (hit) return {
        key: `trigger:${t.id}`, trigger: t, actor: t.actor ? this.actors.get(t.actor) : undefined, knot: t.knot,
        at: { x: t.x + t.width / 2, y: Math.min(t.y - 5, p.y - this.player.height - 8) },
        icon: t.icon ?? 'look',
      };
    }
    return null;
  }

  private updateHint(target: Target | null) {
    const next = this.map.view === 'top' && target && !target.trigger?.hidden ? target : null;
    const key = next?.key ?? '';
    if (key === this.hintTargetKey) {
      if (next && this.hintCurrentKey === key) this.positionHint(next);
      return;
    }
    this.hintTargetKey = key;
    const transition = ++this.hintTransition;
    this.tweens.killTweensOf(this.hintRoot);
    this.tweens.killTweensOf(this.hintBob);
    const show = () => {
      if (transition !== this.hintTransition) return;
      if (!next) {
        this.hintRoot.setVisible(false);
        this.hintCurrentKey = '';
        return;
      }
      this.hintCurrentKey = key;
      this.hintBubble.setTexture(`hint:${next.icon}`);
      this.positionHint(next);
      this.hintBob.setY(-2);
      this.hintRoot.setVisible(true).setAlpha(1).setScale(0);
      this.tweens.add({ targets: this.hintRoot, scale: 1, duration: 140, ease: 'Back.Out' });
      this.tweens.add({
        targets: this.hintBob, y: 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        onUpdate: () => this.hintBob.setY(Math.round(this.hintBob.y)),
      });
    };
    if (this.hintCurrentKey) {
      this.tweens.add({
        targets: this.hintRoot, alpha: 0, duration: 80,
        onComplete: () => {
          this.hintRoot.setVisible(false);
          this.hintCurrentKey = '';
          show();
        },
      });
    } else {
      show();
    }
  }

  private positionHint(target: Target) {
    this.hintRoot.setPosition(Math.round(target.at.x), Math.round(target.at.y));
  }

  private updateExitCue() {
    const p = this.player.pos;
    let nearest: { exit: MapExit; distance: number } | null = null;
    for (const exit of this.map.exits) {
      const dx = Math.max(exit.x - p.x, 0, p.x - (exit.x + exit.width));
      const dy = Math.max(exit.y - p.y, 0, p.y - (exit.y + exit.height));
      const distance = Math.hypot(dx, dy);
      if (!nearest || distance < nearest.distance) nearest = { exit, distance };
    }
    if (!nearest || nearest.distance > 180) {
      if (!this.exitCueKey) return;
      this.exitCueKey = '';
      const transition = ++this.exitCueTransition;
      this.tweens.killTweensOf(this.exitCue);
      this.tweens.add({
        targets: this.exitCue, alpha: 0, duration: 120,
        onComplete: () => {
          if (transition === this.exitCueTransition) this.exitCue.setVisible(false);
        },
      });
      return;
    }

    const exit = nearest.exit;
    const edge = exitEdge(exit, this.map.width, this.map.height);
    const title = (maps[exit.map]?.title ?? exit.map).split('·').pop()?.trim() ?? exit.map;
    const isMapEdge = exit.x <= 0 || exit.x + exit.width >= this.map.width || exit.y <= 0 || exit.y + exit.height >= this.map.height;
    const key = `${exit.id}:${edge}:${title}:${isMapEdge ? 'edge' : 'door'}`;
    const camera = this.cameras.main;
    const viewWidth = this.scale.width;
    const viewHeight = this.scale.height;
    const screenX = Math.round((exit.x + exit.width / 2 - camera.scrollX) * camera.zoom + camera.x);
    const screenY = Math.round(Math.max(24, Math.min(viewHeight - 24,
      (exit.y + exit.height / 2 - camera.scrollY) * camera.zoom + camera.y)));
    this.exitCueText.setText(title);
    const labelOnLeft = screenX + this.exitCueText.width + 28 > viewWidth;
    if (isMapEdge && (edge === 'left' || edge === 'right')) {
      this.exitCue.setPosition(0, screenY);
    } else if (isMapEdge) {
      this.exitCue.setPosition(Math.max(100, Math.min(viewWidth - 100, screenX)), edge === 'up' ? 24 : viewHeight - 24);
    } else {
      this.exitCue.setPosition(Math.max(40, Math.min(viewWidth - 40, screenX)),
        Math.max(24, Math.min(viewHeight - 24, (exit.y - camera.scrollY) * camera.zoom + camera.y - 12)));
    }
    if (key === this.exitCueKey) return;

    this.exitCueKey = key;
    this.exitCueTransition++;
    this.tweens.killTweensOf(this.exitCue);
    this.exitCue.setAlpha(0).setVisible(true);
    this.exitCueGraphics.clear();
    if (isMapEdge && edge === 'left') {
      this.exitCueGraphics.fillStyle(0x1a120a).fillRect(0, -7, 24, 14);
      this.exitCueGraphics.fillStyle(0xe6c77a)
        .fillRect(1, -4, 6, 8).fillRect(6, -2, 16, 4);
      this.exitCueText.setOrigin(0, 0.5).setPosition(30, 0);
    } else if (isMapEdge && edge === 'right') {
      this.exitCueGraphics.fillStyle(0x1a120a).fillRect(viewWidth - 24, -7, 24, 14);
      this.exitCueGraphics.fillStyle(0xe6c77a)
        .fillRect(viewWidth - 22, -2, 16, 4).fillRect(viewWidth - 7, -4, 6, 8);
      this.exitCueText.setOrigin(1, 0.5).setPosition(viewWidth - 30, 0);
    } else {
      const x = isMapEdge ? 0 : -20;
      const textX = labelOnLeft ? -18 : 18;
      this.exitCueText.setOrigin(labelOnLeft ? 1 : 0, 0.5).setPosition(textX, 0);
      if (edge === 'up') {
        this.exitCueGraphics.fillStyle(0x1a120a)
          .fillRect(x - 10, -10, 20, 4).fillRect(x - 6, -6, 12, 4).fillRect(x - 2, -2, 4, 14);
        this.exitCueGraphics.fillStyle(0xe6c77a)
          .fillRect(x - 7, -8, 14, 2).fillRect(x - 4, -6, 8, 3).fillRect(x - 1, -3, 2, 13);
      } else if (edge === 'down') {
        this.exitCueGraphics.fillStyle(0x1a120a)
          .fillRect(x - 2, -8, 4, 14).fillRect(x - 6, 6, 12, 4).fillRect(x - 10, 10, 20, 4);
        this.exitCueGraphics.fillStyle(0xe6c77a)
          .fillRect(x - 1, -7, 2, 13).fillRect(x - 4, 6, 8, 3).fillRect(x - 7, 9, 14, 2);
      } else if (edge === 'left') {
        this.exitCueGraphics.fillStyle(0x1a120a)
          .fillRect(x - 10, -2, 4, 4).fillRect(x - 6, -6, 4, 12).fillRect(x - 2, -10, 14, 20);
        this.exitCueGraphics.fillStyle(0xe6c77a)
          .fillRect(x - 8, -1, 3, 2).fillRect(x - 5, -4, 3, 8).fillRect(x - 2, -7, 12, 14);
      } else {
        this.exitCueGraphics.fillStyle(0x1a120a)
          .fillRect(x - 4, -10, 14, 20).fillRect(x, -6, 4, 12).fillRect(x + 4, -2, 4, 4);
        this.exitCueGraphics.fillStyle(0xe6c77a)
          .fillRect(x - 2, -7, 12, 14).fillRect(x + 1, -4, 2, 8).fillRect(x + 3, -1, 3, 2);
      }
    }
    this.tweens.add({ targets: this.exitCue, alpha: 1, duration: 160 });
  }

  private async systemMenu() {
    if (this.busy) return;
    const text = UI_STRINGS[this.map.script];
    const pick = await this.choices.show([text.save, text.load, text.back], { x: 360, y: 150, title: text.menu });
    if (pick === 0) {
      this.saveGame(1);
      this.toast(UI_STRINGS[this.map.script].saved);
    } else if (pick === 1) {
      this.toast(this.loadGame(1) ? UI_STRINGS[this.map.script].loaded : UI_STRINGS[this.map.script].noSave);
    }
  }

  /** Walk-off exit: fade, swap map, fade back. */
  private async travel(destination: MapExit | string, anchor?: string) {
    if (typeof destination !== 'string' && destination.sfx) this.sfx(destination.sfx);
    this.changing = true;
    this.player.setMoving(false);
    await this.fade(true, 250);
    this.placeMap(typeof destination === 'string' ? destination : destination.map,
      typeof destination === 'string' ? anchor ?? null : destination.anchor);
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
    if (m.player !== this.player.id) {
      this.player.sprite.destroy();
      this.actors.delete(this.player.id);
      this.player = this.spawn(m.player, m.anchors[anchor ?? ''] ?? Object.values(m.anchors)[0] ?? { x: 0, y: 0 });
      this.bindPlayerFootsteps(this.player);
    }
    this.bg.setTexture(`bg:${this.mapId}`).setDisplaySize(m.width, m.height);
    for (const f of this.fg) f.destroy();
    this.fg = m.foreground.map((f, i) => this.cutout(`fg:${this.mapId}:${i}`, f.polygon, f.baseline));
    this.ambient?.destroy();
    this.ambient = new Ambient(this, `bg:${this.mapId}`, m.width, m.height, m.ambient, (v) => !!this.runner.variables()[v], (id, options) => this.sfx(id, options));
    for (const a of m.actors) {
      const saved = this.mapState[this.mapId]?.[a.id];
      const actor = this.spawn(a.id, saved ?? a);
      actor.setFace((saved?.face ?? a.face) as Dir);
      if (saved) actor.sprite.setVisible(saved.visible);
    }
    if (anchor !== null) this.player.setPos(m.anchors[anchor] ?? Object.values(m.anchors)[0]);
    this.lastAmbientPos = { ...this.player.pos };
    this.stillFor = 0;
    this.currentSpeed = 0;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, m.width, m.height);
    cam.startFollow(this.player.sprite, true, 0.15, 0.15);
    cam.centerOn(this.player.pos.x, this.player.pos.y);
    const ys = m.walkable.flatMap((poly) => poly.map((p) => p.y));
    const top = ys.length ? Math.min(...ys) : 0;
    const bottom = ys.length ? Math.max(...ys) : m.height;
    for (const actor of this.actors.values()) actor.setDepthMap(m.view === 'side', top, bottom, m.scaleFar, m.scaleNear);
    const framed = m.art === 'ming' && m.view === 'side';
    this.frameOverlay.clear().setVisible(framed);
    if (framed) {
      this.frameOverlay.fillStyle(0xefe3c4, 1)
        .fillRect(0, 0, WIDTH, 10)
        .fillRect(0, HEIGHT - 10, WIDTH, 10)
        .fillRect(0, 10, 10, HEIGHT - 20)
        .fillRect(WIDTH - 10, 10, 10, HEIGHT - 20)
        .lineStyle(1, 0x2a1d12, 1)
        .strokeRect(10.5, 10.5, WIDTH - 21, HEIGHT - 21);
    }
    const art = m.art ?? style;
    this.game.canvas.style.imageRendering = art === 'retro' ? 'pixelated' : 'auto';
    this.dialogue = m.dialogue === 'bubble' ? this.speechBubble : this.dialogueBox;
    this.choices.setTheme(m.dialogue === 'bubble' ? 'paper' : 'pixel');
    this.setPaperTheme(m.dialogue === 'bubble');
    this.speechBubble.setDepth(framed ? 9_700 : 10_000);
    this.controlsLine.setDepth(framed ? 9_900 : 9_500);
    this.areaLabel.setDepth(framed ? 9_900 : 9_500);
    if (framed) {
      this.controlsLine.setPosition(12, HEIGHT - 24);
      this.areaLabel.setPosition(WIDTH - 12, 0);
    } else {
      this.controlsLine.setPosition(10, HEIGHT - 20);
      this.areaLabel.setPosition(WIDTH - 10, 10);
    }
    this.updateHint(null);
    if (m.bgm) this.loop('bgm', m.bgm, 1.5);
    if (m.ambience) this.loop('ambience', m.ambience, 1.5);
    this.areaLabel.setText(m.title);
  }

  private setPaperTheme(paper: boolean) {
    const text = UI_STRINGS[this.map.script];
    this.controlsLine.setText(text.controls);
    const uiFont = paper ? HANDS.song.family : FONT;
    this.toastText.setStyle(paper
      ? { fontFamily: uiFont, fontSize: '22px', color: '#22170d', backgroundColor: '#efe3c4f2' }
      : { fontFamily: FONT, fontSize: '24px', color: '#ffe7a3', backgroundColor: '#131b2fe6' });
    this.areaLabel.setStyle(paper
      ? { fontFamily: uiFont, fontSize: '18px', color: '#22170d', backgroundColor: '#efe3c4' }
      : { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066' });
    this.controlsLine.setStyle(paper
      ? { fontFamily: uiFont, fontSize: '15px', color: '#22170d', backgroundColor: '#efe3c4dd' }
      : { fontFamily: FONT, fontSize: '12px', color: '#ffffffcc', backgroundColor: '#00000066' });
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
    this.toast(UI_STRINGS[this.map.script].reloaded);
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

  private sfx(id: string | undefined, options: { volume?: number; detune?: number } = {}) {
    if (!id || !this.cache.audio.exists(`sfx:${id}`)) return false;
    this.sound.play(`sfx:${id}`, { volume: options.volume ?? 0.7, detune: options.detune });
    return true;
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
