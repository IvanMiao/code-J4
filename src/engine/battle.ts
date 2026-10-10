/** M0 stub battle: party attacks or defends, enemies hit back. Real turn system comes later. */
export interface Fighter { name: string; side: 'party' | 'enemy'; hp: number; maxHp: number; attack: number; defending: boolean }
export interface Encounter {
  name: string;
  enemies: { name: string; hp: number; attack: number }[];
  party: { id: string; hp: number; attack: number }[];
}
export type Rng = () => number;

export function createBattle(enc: Encounter, nameOf: (id: string) => string): Fighter[] {
  return [
    ...enc.party.map((p) => ({ name: nameOf(p.id), side: 'party' as const, hp: p.hp, maxHp: p.hp, attack: p.attack, defending: false })),
    ...enc.enemies.map((e) => ({ name: e.name, side: 'enemy' as const, hp: e.hp, maxHp: e.hp, attack: e.attack, defending: false })),
  ];
}

const alive = (fs: Fighter[], side: Fighter['side']) => fs.filter((f) => f.side === side && f.hp > 0);

function hit(attacker: Fighter, target: Fighter, rng: Rng): string {
  const dmg = Math.max(1, Math.round((attacker.attack + Math.floor(rng() * 3)) / (target.defending ? 2 : 1)));
  target.hp = Math.max(0, target.hp - dmg);
  return `${attacker.name} → ${target.name}  -${dmg}${target.hp === 0 ? '（倒下）' : ''}`;
}

export function playRound(fs: Fighter[], action: 'attack' | 'defend', rng: Rng = Math.random): string[] {
  const log: string[] = [];
  for (const p of alive(fs, 'party')) {
    p.defending = action === 'defend';
    const target = alive(fs, 'enemy')[0];
    if (action === 'attack' && target) log.push(hit(p, target, rng));
    if (action === 'defend') log.push(`${p.name} 防御`);
  }
  for (const e of alive(fs, 'enemy')) {
    const targets = alive(fs, 'party');
    if (targets.length) log.push(hit(e, targets[Math.floor(rng() * targets.length)], rng));
  }
  return log;
}

export function outcome(fs: Fighter[]): 'win' | 'lose' | null {
  if (!alive(fs, 'enemy').length) return 'win';
  if (!alive(fs, 'party').length) return 'lose';
  return null;
}
