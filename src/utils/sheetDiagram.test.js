import { describe, expect, it } from 'vitest';
import { PAGE_LAYOUTS } from '../constants';
import { firstSheet, sideSvg } from './sheetDiagram.js';

// A5 pages folded once on A4: the folio turns each page a quarter, two to a side
const book = {
  cropbox: { width: 420, height: 595 },
  padding_pt: { binding: 0, fore_edge: 0, top: 0, bottom: 0 },
  papersize: [595, 842],
  page_layout: PAGE_LAYOUTS.folio,
  alt_layout: null,
  page_positioning: 'centered',
  page_scaling: 'lockratio',
  per_sheet: 4,
  book: {
    pagelistdetails: [
      [
        [{ info: 3 }, { info: 0 }],
        [{ info: 1 }, { info: 'b' }],
      ],
    ],
  },
};

describe('firstSheet', () => {
  it('numbers each side from 1 and leaves blanks empty', () => {
    const { sides } = firstSheet(book);
    expect(sides.map((side) => side.map((page) => page.number))).toEqual([
      [4, 1],
      [2, null],
    ]);
  });

  it('keeps every turned page on the paper', () => {
    const { sides, cells } = firstSheet(book);
    expect(cells).toHaveLength(2);
    sides.flat().forEach(({ rotation, corners }) => {
      expect(rotation).toBe(-90);
      corners.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(-0.01);
        expect(x).toBeLessThanOrEqual(595.01);
        expect(y).toBeGreaterThanOrEqual(-0.01);
        expect(y).toBeLessThanOrEqual(842.01);
      });
    });
  });

  it('draws the fold between the two pages', () => {
    const sheet = firstSheet(book);
    const svg = sideSvg(sheet, sheet.sides[0], 'Frente', (n) => n.join(','));
    expect(svg).toContain('M0 421.0H595');
    expect(svg).toContain('aria-label="4,1"');
  });

  it('draws nothing for a book without signatures', () => {
    expect(firstSheet({ ...book, book: { pagelistdetails: [[[]]] } })).toBeNull();
  });
});
