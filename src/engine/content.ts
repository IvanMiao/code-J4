export interface CastMember {
  name: string;
  cat?: boolean;
  sprite: string;
  default: string;
  art?: string;
  sheet?: 'walk4' | 'side';
  height?: number;
  hand?: string;
  portraits?: Record<string, string>;
  emotions?: string[];
  voice?: { id: string | null; tags?: Record<string, string> };
  meows?: Record<string, string>;
}
export type Cast = Record<string, CastMember>;
export interface Item { name: string; description?: string }

export function isValidEmotion(member: CastMember, emotion: string): boolean {
  return !!member.portraits?.[emotion] || !!member.emotions?.includes(emotion);
}

/** Resolves `林夏` or `linxia` to the cast id. */
export function speakerResolver(cast: Cast): (name: string) => string | null {
  const byName = new Map<string, string>();
  for (const [id, c] of Object.entries(cast)) {
    byName.set(id, id);
    byName.set(c.name, id);
  }
  return (name) => byName.get(name) ?? null;
}
