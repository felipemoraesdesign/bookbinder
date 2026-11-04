// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { describe, expect, it } from 'vitest';
import { fromPt, toPt } from './units';

describe('units', () => {
  it('turns what is typed in mm, cm or inches into pt', () => {
    expect(toPt('210', 'mm')).toBe(595.28);
    expect(toPt('21', 'cm')).toBe(595.28);
    expect(toPt('1', 'in')).toBe(72);
    expect(toPt('12.5', 'pt')).toBe(12.5);
  });

  it('shows pt in the chosen unit at a useful precision', () => {
    expect(fromPt(595.28, 'mm')).toBe(210);
    expect(fromPt(12.2, 'mm')).toBe(4.3);
    expect(fromPt(72, 'in')).toBe(1);
    expect(fromPt(36, 'pt')).toBe(36);
  });

  it('round-trips without drifting', () => {
    expect(fromPt(toPt('4.3', 'mm'), 'mm')).toBe(4.3);
    expect(fromPt(toPt('140', 'mm'), 'mm')).toBe(140);
  });

  it('keeps blanks blank', () => {
    expect(toPt('', 'mm')).toBe('');
    expect(toPt(null, 'mm')).toBeNull();
    expect(fromPt(undefined, 'mm')).toBe('');
  });
});
