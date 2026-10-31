// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { describe, expect, it } from 'vitest';
import { pageRangeError, parsePageRange } from './pageRange';

describe('parsePageRange', () => {
  it('returns all pages when no range is provided', () => {
    expect(parsePageRange('', 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('parses single pages and ranges into sorted zero-based indices', () => {
    expect(parsePageRange('3, 1-2, 6-4', 8)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('falls back to the full document when nothing valid matches', () => {
    expect(parsePageRange('abc, 99-100', 5)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('pageRangeError', () => {
  it('accepts empty and well-formed ranges', () => {
    expect(pageRangeError('', 10)).toBeNull();
    expect(pageRangeError('1-8, 10,', 10)).toBeNull();
    expect(pageRangeError('8-12', 10)).toBeNull();
  });

  it('flags malformed tokens', () => {
    expect(pageRangeError('1-8, abc', 10)).toBe('syntax');
    expect(pageRangeError('1--3', 10)).toBe('syntax');
  });

  it('flags ranges that miss the document entirely', () => {
    expect(pageRangeError('20-30', 10)).toBe('out_of_range');
    expect(pageRangeError('20-30', undefined)).toBeNull();
  });
});
