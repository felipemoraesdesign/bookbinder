// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { i18n } from '../i18n.js';
import { schema } from '../models/configuration';

const STORAGE_KEY = 'bookbinderPresets';

// The page range belongs to one PDF, not to a way of binding, so presets leave it out.
function presetSettings(configuration) {
  const settings = { ...configuration };
  delete settings.pageRange;
  return settings;
}

/**
 * Reads the saved presets, dropping any that no longer fit the settings schema.
 * @returns {{ name: string, settings: object }[]}
 */
export function loadPresets() {
  let stored;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((preset) => {
    const parsed = schema.safeParse(preset?.settings);
    if (typeof preset?.name !== 'string' || !parsed.success) return [];
    // A value that is no longer valid parses to undefined; dropping it (the JSON round trip) and
    // parsing again gives that setting its default.
    const settings = schema.parse(JSON.parse(JSON.stringify(parsed.data)));
    return [{ name: preset.name, settings: presetSettings(settings) }];
  });
}

export function savePresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

/** Adds a preset, replacing one with the same name (ignoring case) in place. */
export function withPreset(presets, name, configuration) {
  const preset = { name, settings: presetSettings(configuration) };
  const same = (other) => other.name.toLocaleLowerCase() === name.toLocaleLowerCase();
  return presets.some(same)
    ? presets.map((other) => (same(other) ? preset : other))
    : [...presets, preset];
}

export function withoutPreset(presets, name) {
  return presets.filter((preset) => preset.name !== name);
}

export function matchesPreset(preset, configuration) {
  return JSON.stringify(preset.settings) === JSON.stringify(presetSettings(configuration));
}

/**
 * Lists the saved presets above the settings: a click applies one, and the current settings can be saved under a name.
 * @param {object} options
 * @param {() => object} options.read - the current configuration
 * @param {(settings: object) => void} options.apply - puts a preset's settings in the form
 * @param {() => string} options.suggestName - a name that describes the current settings
 * @returns {() => void} re-renders the list, marking the preset the current settings match
 */
export function setupPresets({ read, apply, suggestName }) {
  const list = document.getElementById('preset_list');
  const empty = document.getElementById('presets_empty');
  const newButton = document.getElementById('preset_new');
  const form = document.getElementById('preset_form');
  const nameInput = document.getElementById('preset_name');
  let presets = loadPresets();
  let added = null; // the preset just saved, which animates in once

  const renderItem = (preset, current) => {
    const item = document.createElement('li');
    item.className = 'preset';
    item.classList.toggle('is-new', preset.name === added);

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'preset-apply';
    applyButton.textContent = preset.name;
    applyButton.title = preset.name;
    applyButton.setAttribute('aria-pressed', matchesPreset(preset, current));
    applyButton.addEventListener('click', () => apply(preset.settings));

    // Deleting takes a second click within 3 s, like restoring the defaults
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'preset-delete';
    deleteButton.setAttribute('aria-label', i18n.t('preset_delete', { name: preset.name }));
    deleteButton.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
    let disarm;
    deleteButton.addEventListener('click', () => {
      if (!item.classList.contains('is-armed')) {
        item.classList.add('is-armed');
        deleteButton.textContent = i18n.t('preset_delete_confirm');
        disarm = setTimeout(render, 3000);
        return;
      }
      clearTimeout(disarm);
      presets = withoutPreset(presets, preset.name);
      savePresets(presets);
      render();
      newButton.focus();
    });

    item.append(applyButton, deleteButton);
    return item;
  };

  const render = () => {
    const current = read();
    list.replaceChildren(...presets.map((preset) => renderItem(preset, current)));
    empty.hidden = presets.length > 0;
    added = null;
  };

  const openForm = () => {
    form.hidden = false;
    newButton.hidden = true;
    nameInput.value = suggestName();
    nameInput.focus();
    nameInput.select();
  };

  const closeForm = () => {
    form.hidden = true;
    newButton.hidden = false;
    newButton.focus();
  };

  const save = () => {
    const name = nameInput.value.trim();
    if (!name) return nameInput.focus();
    presets = withPreset(presets, name, read());
    savePresets(presets);
    added = name;
    closeForm();
    render();
  };

  newButton.addEventListener('click', openForm);
  document.getElementById('preset_confirm').addEventListener('click', save);
  document.getElementById('preset_cancel').addEventListener('click', closeForm);
  nameInput.addEventListener('keydown', (e) => {
    // Enter would submit the settings form and reload the page
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeForm();
    }
  });

  render();
  return render;
}
