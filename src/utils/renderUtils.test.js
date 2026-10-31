// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, it } from 'vitest';
import { renderSignatureBlock } from './renderUtils';

describe('renderSignatureBlock', () => {
  it('draws one svg per signature with one path per sheet', () => {
    const container = document.createElement('div');
    renderSignatureBlock(container, [4, 4, 3]);
    const sigs = container.querySelectorAll('svg.sig');
    expect(sigs.length).toBe(3);
    expect([...sigs].map((svg) => svg.querySelectorAll('path').length)).toEqual([4, 4, 3]);
    expect(container.innerHTML).not.toContain('NaN');
  });

  it('keeps a 30-sheet booklet inside the drawing height', () => {
    const container = document.createElement('div');
    renderSignatureBlock(container, [30]);
    const innermost = container.querySelectorAll('path')[29].getAttribute('d');
    expect(innermost).not.toContain('NaN');
    expect(innermost).not.toContain('-');
  });
});
