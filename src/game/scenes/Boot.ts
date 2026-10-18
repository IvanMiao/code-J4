import Phaser from 'phaser';
import { artUrl, audioUrl, cast, FONT, maps, style, type AudioIndex } from '../config.ts';
import { ensureInteractionHintTextures } from '../ui/InteractionHint.ts';

export const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 } as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.add.text(480, 270, '载入中…', { fontFamily: FONT, fontSize: '24px', color: '#d9c9a0' }).setOrigin(0.5);
    for (const [id, m] of Object.entries(maps)) this.load.image(`bg:${id}`, artUrl(m.background, m.art ?? style));
    for (const [id, c] of Object.entries(cast)) {
      this.load.image(`sheet:${id}`, artUrl(c.sprite, c.art ?? style));
      for (const [emo, file] of Object.entries(c.portraits ?? {})) this.load.image(`portrait:${id}:${emo}`, artUrl(file, c.art ?? style));
    }
    this.load.json('audioIndex', audioUrl('index.json'));
  }

  create() {
    for (const id of Object.keys(cast)) this.buildWalkSheet(id);
    ensureInteractionHintTextures(this);
    for (const [id, m] of Object.entries(maps)) {
      if ((m.art ?? style) === 'retro') this.textures.get(`bg:${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (const [id, member] of Object.entries(cast)) {
      if ((member.art ?? style) === 'retro') {
        this.textures.get(`sheet:${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
        for (const emo of Object.keys(member.portraits ?? {})) {
          this.textures.get(`portrait:${id}:${emo}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }
    const index = (this.cache.json.get('audioIndex') ?? {}) as AudioIndex;
    this.registry.set('audioIndex', index);
    let queued = 0;
    for (const kind of ['bgm', 'ambience', 'sfx', 'vo'] as const) {
      for (const [id, path] of Object.entries(index[kind] ?? {})) {
        this.load.audio(`${kind}:${id}`, audioUrl(path));
        queued++;
      }
    }
    if (!queued) return this.scene.start('field');
    this.load.once('complete', () => this.scene.start('field'));
    this.load.start();
  }

  /** Walk sheets are 3 columns (step, stand, step), with either four facing rows or two side rows. */
  private buildWalkSheet(id: string) {
    const tex = this.textures.get(`sheet:${id}`);
    const src = tex.getSourceImage() as HTMLImageElement;
    const side = cast[id].sheet === 'side';
    const rows = side ? 2 : 4;
    const w = Math.floor(src.width / 3), h = Math.floor(src.height / rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) tex.add(r * 3 + c, 0, c * w, r * h, w, h);
    const directions = side ? { left: 0, right: 1 } : {
      ...DIR_ROW,
      right: (cast[id].art ?? style) === 'hd' ? 1 : 2,
    };
    for (const [dir, row] of Object.entries(directions)) {
      this.anims.create({
        key: `${id}:walk:${dir}`,
        frames: [0, 1, 2, 1].map((c) => ({ key: `sheet:${id}`, frame: row * 3 + c })),
        frameRate: 7,
        repeat: -1,
      });
    }
  }
}
