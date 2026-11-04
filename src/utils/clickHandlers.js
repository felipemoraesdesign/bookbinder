// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { i18n } from '../i18n.js';
import { makesSinglePdf } from './download.js';
import { resetForm } from './formUtils';
import {
  clearPreview,
  updateAddOrRemoveCustomPaperOption,
  updatePaperSelectOptionsUnits,
} from './renderUtils';

// Buttons hold an icon plus a [data-i18n] label; swap only the label so the icon stays.
function setBusy(buttonEl, labelKey) {
  // keep the button's width while its label changes, so the buttons beside it don't shift
  buttonEl.style.minWidth = `${buttonEl.offsetWidth}px`;
  buttonEl.setAttribute('disabled', true);
  buttonEl.classList.add('is-busy');
  setLabel(buttonEl, labelKey);
}

function setIdle(buttonEl, labelKey) {
  buttonEl.style.minWidth = '';
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
  setNote(note, messageKey);
}

function setNote(note, messageKey) {
  note.setAttribute('data-i18n', messageKey);
  note.textContent = i18n.t(messageKey);
}

function clearActionError() {
  const note = document.getElementById('action_note');
  note.classList.remove('is-error');
  setNote(note, note.dataset.downloadKey ?? 'download_note');
}

/**
 * Tells, under the actions, whether the download is a single PDF or a .zip.
 * @param {{ sigFormat: string, printFile: string, printerType: string }} settings
 */
export function renderDownloadNote(settings) {
  const note = document.getElementById('action_note');
  note.dataset.downloadKey = makesSinglePdf(settings) ? 'download_note_pdf' : 'download_note';
  if (!note.classList.contains('is-error')) setNote(note, note.dataset.downloadKey);
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
    .then((fileName) => {
      console.log('Generated result!');
      setDone(generateEl, 'btn_done', 'btn_generate');
      // Names the file under the actions (read out by screen readers) until a setting changes
      const note = document.getElementById('action_note');
      note.removeAttribute('data-i18n');
      note.textContent = i18n.t('download_done', { name: fileName });
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
