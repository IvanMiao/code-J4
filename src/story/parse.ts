export interface LineEvent {
  kind: 'line';
  speaker: string | null;
  text: string;
  emotion: string | null;
  lineId: string | null;
  voiced: boolean;
  tags: string[];
}

export interface CommandEvent {
  kind: 'command';
  name: string;
  args: string[];
  options: Record<string, string>;
  raw: string;
}

export type StoryEvent = LineEvent | CommandEvent;

const SPEAKER = /^([^\s:：@#]{1,16})\s*[:：]\s*(.+)$/;
const COMMAND = /^@([a-z_]+)\s*(.*)$/;

export function parseCommand(text: string): CommandEvent | null {
  const m = COMMAND.exec(text.trim());
  if (!m) return null;
  const args: string[] = [];
  const options: Record<string, string> = {};
  for (const tok of m[2].split(/\s+/).filter(Boolean)) {
    const eq = tok.indexOf('=');
    if (eq > 0) options[tok.slice(0, eq)] = tok.slice(eq + 1);
    else args.push(tok);
  }
  return { kind: 'command', name: m[1], args, options, raw: text.trim() };
}

/**
 * Turns one ink output line into a game event.
 * `Speaker: text #emotion #vo #line:id` is a line; `@name arg key=value` is a command;
 * anything else is narration. `speakerOf` maps display names / ids to cast ids.
 */
export function parseStoryLine(text: string, tags: string[], speakerOf: (name: string) => string | null): StoryEvent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cmd = parseCommand(trimmed);
  if (cmd) return cmd;
  let speaker: string | null = null;
  let body = trimmed;
  const m = SPEAKER.exec(trimmed);
  if (m && speakerOf(m[1])) {
    speaker = speakerOf(m[1]);
    body = m[2].trim();
  }
  let emotion: string | null = null;
  let lineId: string | null = null;
  let voiced = false;
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag.startsWith('line:')) lineId = tag.slice(5);
    else if (tag === 'vo') voiced = true;
    else if (!tag.includes(':') && !emotion) emotion = tag;
  }
  return { kind: 'line', speaker, text: body, emotion, lineId, voiced, tags };
}
