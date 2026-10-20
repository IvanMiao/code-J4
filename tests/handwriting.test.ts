import { describe, expect, it } from 'vitest';
import { layoutGlyphs, parseCorrections, plainText } from '../src/engine/handwriting.ts';

describe('handwriting corrections', () => {
  it('parses replacements and deletions and shows the final reading', () => {
    expect(parseCorrections('〔错｜对〕〔旧｜〕字')).toEqual([
      { text: '错', struck: true },
      { text: '对', struck: false },
      { text: '旧', struck: true },
      { text: '字', struck: false },
    ]);
    expect(plainText('甲〔错｜对〕乙〔旧｜〕丙')).toBe('甲对乙丙');
    expect(plainText('甲〔错|对〕乙')).toBe('甲〔错|对〕乙');
  });

  it('wraps at the column limit and keeps closing punctuation off a new line', () => {
    const wrapped = layoutGlyphs([{ text: '甲乙丙丁', struck: false }], 2);
    expect(wrapped.map(({ ch, col, row }) => [ch, col, row])).toEqual([
      ['甲', 0, 0], ['乙', 1, 0], ['丙', 0, 1], ['丁', 1, 1],
    ]);
    const kinsoku = layoutGlyphs([{ text: '甲乙丙。丁', struck: false }], 3);
    expect(kinsoku.find((glyph) => glyph.ch === '。')).toMatchObject({ row: 0, col: 3 });
    expect(kinsoku.find((glyph) => glyph.ch === '丁')?.row).toBe(1);
  });

  it('keeps opening quotation marks off line ends and closing marks off line starts', () => {
    const glyphs = layoutGlyphs([{ text: '甲乙「丙丁『戊己」庚辛』', struck: false }], 3);
    expect(glyphs.find((glyph) => glyph.ch === '「')).toMatchObject({ row: 1, col: 0 });
    expect(glyphs.find((glyph) => glyph.ch === '『')).toMatchObject({ row: 2, col: 0 });
    expect(glyphs.find((glyph) => glyph.ch === '」')).toMatchObject({ row: 2, col: 3 });
    expect(glyphs.find((glyph) => glyph.ch === '』')).toMatchObject({ row: 3, col: 2 });
  });
});
