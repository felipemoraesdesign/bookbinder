// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Checks the custom signatures field ("10, 10, 8": sheets per signature) against the sheets the
 * pages fill. Fewer sheets leave the end of the book out; more add blank pages at the end.
 * @param {string} value - the field as typed
 * @param {number} [neededSheets] - sheets the pages fill, once a PDF is laid out
 * @returns {null | { kind: 'syntax' } | { kind: 'short' | 'long', sum: number, needed: number }}
 */
export function customSignatureError(value, neededSheets) {
  const tokens = (value ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  if (!tokens.every((token) => /^[1-9]\d*$/.test(token))) return { kind: 'syntax' };
  const sum = tokens.reduce((total, token) => total + Number(token), 0);
  if (!neededSheets || sum === neededSheets) return null;
  return { kind: sum < neededSheets ? 'short' : 'long', sum, needed: neededSheets };
}
