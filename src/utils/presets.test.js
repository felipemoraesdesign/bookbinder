// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { schema } from '../models/configuration';
import { loadPresets, matchesPreset, savePresets, withoutPreset, withPreset } from './presets';

// The test environment has no localStorage
const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
});

const zine = schema.parse({ sigFormat: 'booklet', paperSize: 'A5', pageRange: '1-8' });
const cadernos = schema.parse({ sigFormat: 'standardsig', sigLength: 4 });

describe('presets', () => {
  beforeEach(() => storage.clear());

  it('saves and loads presets without the page range', () => {
    savePresets(withPreset([], 'Zine A5', zine));
    const [preset] = loadPresets();
    expect(preset.name).toBe('Zine A5');
    expect(preset.settings.paperSize).toBe('A5');
    expect(preset.settings).not.toHaveProperty('pageRange');
  });

  it('replaces a preset with the same name in place, ignoring case', () => {
    const presets = withPreset(withPreset([], 'Zine', zine), 'Cadernos', cadernos);
    const updated = withPreset(presets, 'zine', cadernos);
    expect(updated.map((p) => p.name)).toEqual(['zine', 'Cadernos']);
    expect(updated[0].settings.sigFormat).toBe('standardsig');
  });

  it('deletes a preset by name', () => {
    const presets = withPreset(withPreset([], 'Zine', zine), 'Cadernos', cadernos);
    expect(withoutPreset(presets, 'Zine').map((p) => p.name)).toEqual(['Cadernos']);
  });

  it('matches the current settings whatever the page range', () => {
    const [preset] = withPreset([], 'Zine', zine);
    expect(matchesPreset(preset, { ...zine, pageRange: '3-10' })).toBe(true);
    expect(matchesPreset(preset, cadernos)).toBe(false);
  });

  it('ignores stored data it cannot read', () => {
    storage.set('bookbinderPresets', 'not json');
    expect(loadPresets()).toEqual([]);
    storage.set('bookbinderPresets', JSON.stringify([{ name: 'No settings' }, { settings: {} }]));
    expect(loadPresets()).toEqual([]);
  });

  it('falls back to the default for a setting that is no longer valid', () => {
    storage.set(
      'bookbinderPresets',
      JSON.stringify([{ name: 'Old', settings: { sigFormat: 'gone' } }])
    );
    expect(loadPresets()[0].settings.sigFormat).toBe('standardsig');
  });
});
