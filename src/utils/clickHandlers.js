// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { i18n } from '../i18n.js';
import { resetForm } from './formUtils';
import {
  clearPreview,
  updateAddOrRemoveCustomPaperOption,
  updatePaperSelectOptionsUnits,
} from './renderUtils';

// Buttons hold an icon plus a [data-i18n] label; swap only the label so the icon stays.
function setBusy(buttonEl, labelKey) {
  buttonEl.setAttribute('disabled', true);
  buttonEl.classList.add('is-busy');
  setLabel(buttonEl, labelKey);
}

function setIdle(buttonEl, labelKey) {
  buttonEl.removeAttribute('disabled');
  buttonEl.classList.remove('is-busy', 'is-done');
  setLabel(buttonEl, labelKey);
}

// Holds a check mark on the button for a moment so the finished download registers.
function setDone(buttonEl, labelKey, idleKey) {
  buttonEl.classList.replace('is-busy', 'is-done');
  setLabel(buttonEl, labelKey);
  setTimeout(() => setIdle(buttonEl, idleKey), 2400);
}

function showActionError(messageKey) {
  const note = document.getElementById('action_note');
  note.classList.add('is-error');
  note.setAttribute('data-i18n', messageKey);
  note.textContent = i18n.t(messageKey);
}

function clearActionError() {
  const note = document.getElementById('action_note');
  note.classList.remove('is-error');
  note.setAttribute('data-i18n', 'download_note');
  note.textContent = i18n.t('download_note');
}

export function setLabel(buttonEl, labelKey) {
  const label = buttonEl.querySelector('[data-i18n]');
  label.setAttribute('data-i18n', labelKey);
  label.textContent = i18n.t(labelKey);
}

export function handleGenerateClick(generateEl, book) {
  setBusy(generateEl, 'btn_generating');
  clearActionError();
  console.log('The whole Book model:', book);
  const result = book.createoutputfiles(false);
  result
    .then(() => {
      console.log('Generated result!');
      setDone(generateEl, 'btn_done', 'btn_generate');
    })
    .catch((error) => {
      console.error(error);
      setIdle(generateEl, 'btn_generate');
      showActionError('generate_error');
    });
}

export function handlePreviewClick(previewEl, book) {
  setBusy(previewEl, 'btn_previewing');
  clearActionError();
  clearPreview();
  const result = book.createoutputfiles(true);
  result
    .then(() => {
      console.log('Preview result!');
    })
    .catch((error) => {
      console.error(error);
      showActionError('preview_error');
    })
    .finally(() => {
      setIdle(previewEl, 'btn_preview');
    });
}

export function handleResetSettingsClick(book) {
  const defaultConfiguration = resetForm();
  book.update(defaultConfiguration);
  updateAddOrRemoveCustomPaperOption();
  updatePaperSelectOptionsUnits();
}

export function handleSewingMarksCheckboxState(sewingMarksEnabled) {
  const sewingMarkDetailsEl = document.getElementById('sewing_marks_details');
  if (sewingMarksEnabled) {
    sewingMarkDetailsEl.setAttribute('open', 0);
  } else {
    sewingMarkDetailsEl.removeAttribute('open');
  }
}
