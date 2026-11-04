// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, it } from 'vitest';
import { paperName, renderSignatureBlock } from './renderUtils';
import { i18n } from '../i18n';

describe('renderSignatureBlock', () => {
  it('draws one caderno per signature with a fore-edge line between its sheets', () => {
    const container = document.createElement('div');
    renderSignatureBlock(container, [4, 4, 3]);
    const cadernos = container.querySelectorAll('svg.pile g');
    expect(cadernos.length).toBe(3);
    expect([...cadernos].map((g) => g.querySelectorAll('.leaf').length)).toEqual([3, 3, 2]);
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('keeps a 30-sheet booklet and a 40-signature book about 72px tall', () => {
    for (const sigconfig of [[30], Array(40).fill(4)]) {
      const container = document.createElement('div');
      renderSignatureBlock(container, sigconfig);
      const height = Number(container.querySelector('svg').getAttribute('height'));
      expect(height).toBeLessThan(92);
      expect(container.innerHTML).not.toContain('NaN');
    }
  });
});

describe('paperName', () => {
  it('reads paper constants as names', () => {
    expect(paperName('JIS_B5')).toBe('JIS B5');
    expect(paperName('ARCH_E')).toBe('ARCH E');
    expect(paperName('CROWN_QUARTO')).toBe('Crown quarto');
    expect(paperName('PENGUIN_LARGE_PAPERBACK')).toBe('Penguin large paperback');
  });

  it('uses the translation when there is one', async () => {
    await i18n.init();
    expect(paperName('LETTER')).toBe('Carta');
    expect(paperName('FLSA')).toBe('Ofício');
    expect(paperName('A4')).toBe('A4');
  });
});
