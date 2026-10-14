import Phaser from 'phaser';
import { artUrl, audioUrl, cast, FONT, maps, style, type AudioIndex } from '../config.ts';
import { ensureInteractionHintTextures } from '../ui/InteractionHint.ts';

/** Retro sheets have a real right row (mirrored at build time); old HD sheets mirror the left row at runtime. */
export const DIR_ROW = { down: 0, left: 1, right: style === 'hd' ? 1 : 2, up: 3 } as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.add.text(480, 270, '载入中…', { fontFamily: FONT, fontSize: '24px', color: '#d9c9a0' }).setOrigin(0.5);
    for (const [id, m] of Object.entries(maps)) this.load.image(`bg:${id}`, artUrl(m.background));
    for (const [id, c] of Object.entries(cast)) {
      this.load.image(`sheet:${id}`, artUrl(c.sprite));
      for (const [emo, file] of Object.entries(c.portraits)) this.load.image(`portrait:${id}:${emo}`, artUrl(file));
    }
    this.load.json('audioIndex', audioUrl('index.json'));
  }

  create() {
    for (const id of Object.keys(cast)) this.buildWalkSheet(id);
    ensureInteractionHintTextures(this);
    if (style === 'retro') {
      for (const key of this.textures.getTextureKeys()) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
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

  /** AI walk sheets are 3 columns (step, stand, step) × 4 rows (down, left, right, up). Right reuses left, flipped. */
  private buildWalkSheet(id: string) {
    const tex = this.textures.get(`sheet:${id}`);
    const src = tex.getSourceImage() as HTMLImageElement;
    const w = Math.floor(src.width / 3), h = Math.floor(src.height / 4);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) tex.add(r * 3 + c, 0, c * w, r * h, w, h);
    for (const [dir, row] of Object.entries(DIR_ROW)) {
      this.anims.create({
        key: `${id}:walk:${dir}`,
        frames: [0, 1, 2, 1].map((c) => ({ key: `sheet:${id}`, frame: row * 3 + c })),
        frameRate: 7,
        repeat: -1,
      });
    }
  }
}
