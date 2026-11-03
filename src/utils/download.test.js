// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { describe, expect, it } from 'vitest';
import { makesSinglePdf } from './download';

describe('makesSinglePdf', () => {
  it('is a single PDF only when printing duplex', () => {
    expect(makesSinglePdf({ sigFormat: 'booklet', printFile: 'both', printerType: 'duplex' })).toBe(
      true
    );
    expect(makesSinglePdf({ sigFormat: 'booklet', printFile: 'both', printerType: 'single' })).toBe(
      false
    );
  });

  it('follows the chosen files for signatures', () => {
    const sig = { sigFormat: 'standardsig', printerType: 'duplex' };
    expect(makesSinglePdf({ ...sig, printFile: 'aggregated' })).toBe(true);
    expect(makesSinglePdf({ ...sig, printFile: 'both' })).toBe(false);
    expect(makesSinglePdf({ ...sig, printFile: 'signatures' })).toBe(false);
  });

  it('is a single PDF for the special layouts', () => {
    expect(makesSinglePdf({ sigFormat: '8_zine', printFile: 'both', printerType: 'duplex' })).toBe(
      true
    );
  });
});
