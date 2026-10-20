export interface CorrectionSegment {
  text: string;
  struck: boolean;
}

export interface LayoutGlyph {
  ch: string;
  col: number;
  row: number;
  struck: boolean;
  seg: number;
}

const CORRECTION = /〔([^〔〕｜]*)｜([^〔〕]*)〕/g;
const CLOSING = new Set([...'，。、；：？！…」』）》〕']);
const OPENING = new Set([...'「『']);

export function parseCorrections(text: string): CorrectionSegment[] {
  const segments: CorrectionSegment[] = [];
  const append = (value: string, struck: boolean) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last?.struck === struck) last.text += value;
    else segments.push({ text: value, struck });
  };
  let cursor = 0;
  for (const match of text.matchAll(CORRECTION)) {
    const index = match.index ?? 0;
    append(text.slice(cursor, index), false);
    append(match[1], true);
    append(match[2], false);
    cursor = index + match[0].length;
  }
  append(text.slice(cursor), false);
  return segments;
}

export function plainText(text: string): string {
  return parseCorrections(text).filter((segment) => !segment.struck).map((segment) => segment.text).join('');
}

export function layoutGlyphs(segments: CorrectionSegment[], maxCols: number): LayoutGlyph[] {
  const cols = Math.max(1, Math.floor(maxCols));
  const glyphs: LayoutGlyph[] = [];
  let col = 0;
  let row = 0;
  for (let seg = 0; seg < segments.length; seg++) {
    for (const ch of segments[seg].text) {
      if (col >= cols && !CLOSING.has(ch)) {
        row++;
        col = 0;
      }
      if (cols > 1 && OPENING.has(ch) && col === cols - 1) {
        row++;
        col = 0;
      }
      glyphs.push({ ch, col, row, struck: segments[seg].struck, seg });
      col++;
    }
  }
  return glyphs;
}
