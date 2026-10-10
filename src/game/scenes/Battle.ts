import Phaser from 'phaser';
import { cast, FONT } from '../config.ts';
import { createBattle, outcome, playRound, type Encounter, type Fighter } from '../../engine/battle.ts';
import { ChoiceMenu } from '../ui/ChoiceMenu.ts';

export interface BattleData { encounter: Encounter; done: (result: 'win' | 'lose') => void }

/** M0 placeholder battle so `@battle` can be exercised end-to-end. */
export class BattleScene extends Phaser.Scene {
  private fighters: Fighter[] = [];
  private status!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private menu!: ChoiceMenu;

  constructor() {
    super('battle');
  }

  create(data: BattleData) {
    this.fighters = createBattle(data.encounter, (id) => cast[id]?.name ?? id);
    this.add.rectangle(480, 270, 960, 540, 0x05070d, 0.86);
    this.add.text(480, 40, data.encounter.name, { fontFamily: FONT, fontSize: '28px', color: '#ffe39a' }).setOrigin(0.5).setResolution(2);
    this.status = this.add.text(60, 100, '', { fontFamily: FONT, fontSize: '22px', color: '#f1ece0', lineSpacing: 10 }).setResolution(2);
    this.log = this.add.text(60, 330, '', { fontFamily: FONT, fontSize: '18px', color: '#b9c4d8', lineSpacing: 6 }).setResolution(2);
    this.menu = new ChoiceMenu(this);
    const keys = this.input.keyboard!;
    keys.on('keydown-UP', () => this.menu.move(-1));
    keys.on('keydown-DOWN', () => this.menu.move(1));
    for (const k of ['SPACE', 'ENTER', 'Z']) keys.on(`keydown-${k}`, () => this.menu.confirm());
    this.cameras.main.fadeIn(250);
    this.loop(data);
  }

  private render() {
    const line = (f: Fighter) => `${f.name.padEnd(6, '　')} ${'█'.repeat(Math.ceil((f.hp / f.maxHp) * 10)).padEnd(10, '░')} ${f.hp}/${f.maxHp}`;
    const party = this.fighters.filter((f) => f.side === 'party').map(line);
    const enemies = this.fighters.filter((f) => f.side === 'enemy').map(line);
    this.status.setText(['我方', ...party, '', '敌方', ...enemies].join('\n'));
  }

  private async loop(data: BattleData) {
    for (;;) {
      this.render();
      const result = outcome(this.fighters);
      if (result) {
        this.log.setText(result === 'win' ? '胜利！' : '战败……');
        await new Promise((r) => this.time.delayedCall(900, r));
        this.scene.stop();
        return data.done(result);
      }
      const pick = await this.menu.show(['攻击', '防御'], { x: 700, y: 120, title: '行动' });
      this.log.setText(playRound(this.fighters, pick === 0 ? 'attack' : 'defend').join('\n'));
    }
  }
}
