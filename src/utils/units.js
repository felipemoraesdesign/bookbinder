// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// The measurement fields show the chosen unit; settings keep pt, so saved values never change.
const PT_PER_UNIT = { pt: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72 };
const DECIMALS = { pt: 2, mm: 1, cm: 2, in: 3 };

/** The form fields that hold a length (stored in pt). */
export const LENGTH_FIELDS = [
  'paper_size_custom_width',
  'paper_size_custom_height',
  'top_edge_padding_pt',
  'binding_edge_padding_pt',
  'main_fore_edge_padding_pt',
  'bottom_edge_padding_pt',
  'fore_edge_padding_pt',
  'sewing_marks_margin_pt',
  'sewing_marks_tape_width_pt',
];

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * A field's value in pt. Blank stays blank, so an empty custom size still means "none".
 * @param {string | number | null} value - as typed, in `unit`
 * @param {string} unit - 'mm', 'cm', 'in' or 'pt'
 */
export function toPt(value, unit) {
  if (value === null || value === '' || Number.isNaN(Number(value))) return value;
  return round(Number(value) * (PT_PER_UNIT[unit] ?? 1), 2);
}

/**
 * A pt value as the field shows it in `unit`, rounded to that unit's useful precision.
 * @param {number | string | null | undefined} pt
 * @param {string} unit
 */
export function fromPt(pt, unit) {
  if (pt === null || pt === undefined || pt === '' || Number.isNaN(Number(pt))) return pt ?? '';
  return round(Number(pt) / (PT_PER_UNIT[unit] ?? 1), DECIMALS[unit] ?? 2);
}
