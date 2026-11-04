// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

const STORAGE_KEY = 'bookbinderSettings';

export function getLocalSettings() {
  const emptySettings = {};
  let localSettings;
  try {
    localSettings = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // unreadable storage would stop the app from opening: start from the defaults instead
    localSettings = null;
  }
  if (!localSettings || typeof localSettings !== 'object') {
    setLocalSettings(emptySettings);
    return getLocalSettings();
  }
  return localSettings;
}

export function setLocalSettings(newSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
}

export function clearLocalSettings() {
  localStorage.removeItem(STORAGE_KEY);
}
