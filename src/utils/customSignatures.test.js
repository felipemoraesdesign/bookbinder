// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { describe, expect, it } from 'vitest';
import { customSignatureError } from './customSignatures';

describe('customSignatureError', () => {
  it('accepts an empty field and a list that fills the book exactly', () => {
    expect(customSignatureError('', 31)).toBeNull();
    expect(customSignatureError('10, 10, 11', 31)).toBeNull();
    expect(customSignatureError('10,10,11', 31)).toBeNull();
  });

  it('rejects anything but whole numbers above zero', () => {
    expect(customSignatureError('dez, oito', 31)).toEqual({ kind: 'syntax' });
    expect(customSignatureError('10, 0', 31)).toEqual({ kind: 'syntax' });
    expect(customSignatureError('4.5, 4', 31)).toEqual({ kind: 'syntax' });
  });

  it('says when signatures hold fewer or more sheets than the pages fill', () => {
    expect(customSignatureError('10, 10, 8', 31)).toEqual({ kind: 'short', sum: 28, needed: 31 });
    expect(customSignatureError('11, 11, 11', 31)).toEqual({ kind: 'long', sum: 33, needed: 31 });
  });

  it('checks only the syntax before a PDF is laid out', () => {
    expect(customSignatureError('10, 10, 8')).toBeNull();
  });
});
