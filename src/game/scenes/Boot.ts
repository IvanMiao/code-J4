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
    for (const [id, m] of Object.entries(maps)) {
      this.load.image(`bg:${id}`, artUrl(m.background, m.art ?? style));
      for (const layer of m.layers) {
        this.load.image(`layer:${id}:${layer.id}`, artUrl(layer.image, m.art ?? style));
      }
    }
    for (const [id, c] of Object.entries(cast)) {
      this.load.image(`sheet:${id}`, artUrl(c.sprite, c.art ?? style));
      for (const [emo, file] of Object.entries(c.portraits ?? {})) this.load.image(`portrait:${id}:${emo}`, artUrl(file, c.art ?? style));
    }
    this.load.json('audioIndex', audioUrl('index.json'));
  }

  create() {
    for (const id of Object.keys(cast)) this.buildWalkSheet(id);
    this.buildPaperTexture();
    ensureInteractionHintTextures(this);
    for (const [id, m] of Object.entries(maps)) {
      if ((m.art ?? style) === 'retro') this.textures.get(`bg:${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
      for (const layer of m.layers) {
        if ((m.art ?? style) === 'retro') {
          this.textures.get(`layer:${id}:${layer.id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
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

  private buildPaperTexture() {
    const size = 512;
    const texture = this.textures.createCanvas('paper-grain', size, size);
    if (!texture) return;
    const context = texture.context;
    const pixels = context.createImageData(size, size);
    let seed = 0x4d494e47;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 0x1_0000_0000;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wave = Math.sin((x * 2 + y) * Math.PI * 2 / size) * 2.8
          + Math.sin((x - y * 2) * Math.PI * 4 / size) * 1.7
          + Math.cos((x * 3 + y * 2) * Math.PI * 2 / size) * 1.2;
        const fine = Math.sin((x * 61 + y * 19) * Math.PI * 2 / size + 0.73) * 0.8
          + Math.cos((x * 9 - y * 67) * Math.PI * 2 / size + 1.24) * 0.6;
        const base = Math.round(246 + wave + fine);
        const offset = (y * size + x) * 4;
        pixels.data[offset] = Math.min(255, base + 2);
        pixels.data[offset + 1] = base;
        pixels.data[offset + 2] = Math.max(0, base - 8);
        pixels.data[offset + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    context.strokeStyle = 'rgba(135, 102, 65, 0.12)';
    context.lineCap = 'round';
    for (let i = 0; i < 320; i++) {
      const x = random() * size;
      const y = random() * size;
      const length = 4 + random() * 20;
      const angle = (random() - 0.5) * 0.22;
      for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
        context.beginPath();
        context.moveTo(x + dx, y + dy);
        context.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length);
        context.stroke();
      }
    }
    texture.refresh();
  }

  /** Walk sheets are 3 columns (step, stand, step), with either four facing rows or two side rows. */
  private buildWalkSheet(id: string) {
    const tex = this.textures.get(`sheet:${id}`);
    const src = tex.getSourceImage() as HTMLImageElement;
    if (cast[id].sheet === 'pose') {
      const w = Math.floor(src.width / 2);
      for (let c = 0; c < 2; c++) tex.add(c, 0, c * w, 0, w, src.height);
      return;
    }
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
