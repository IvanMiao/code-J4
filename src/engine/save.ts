import type { Facing } from './walk.ts';

export const SAVE_VERSION = 1;

export interface ActorState { x: number; y: number; face: Facing; visible: boolean }

export interface SaveData {
  version: number;
  savedAt: string;
  map: string;
  actors: Record<string, ActorState>;
  inventory: Record<string, number>;
  ink: string;
  introDone: boolean;
}

export interface SaveStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

const key = (slot: number) => `code-j4.save.${slot}`;

export function writeSave(store: SaveStore, slot: number, data: Omit<SaveData, 'version' | 'savedAt'>): SaveData {
  const full: SaveData = { ...data, version: SAVE_VERSION, savedAt: new Date().toISOString() };
  store.setItem(key(slot), JSON.stringify(full));
  return full;
}

export function readSave(store: SaveStore, slot: number): SaveData | null {
  const raw = store.getItem(key(slot));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    return data.version === SAVE_VERSION ? data : null;
  } catch {
    return null;
  }
}

export function addItem(inv: Record<string, number>, id: string, n = 1): void {
  inv[id] = (inv[id] ?? 0) + n;
  if (inv[id] <= 0) delete inv[id];
}
