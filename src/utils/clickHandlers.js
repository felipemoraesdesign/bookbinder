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
  // a setting changed: the last download and its print steps no longer match
  document.getElementById('print_guide').hidden = true;
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
      setDone(generateEl, 'btn_done', generateEl.dataset.idle || 'btn_generate');
      // Names the file under the actions (read out by screen readers) until a setting changes
      const note = document.getElementById('action_note');
      note.removeAttribute('data-i18n');
      note.textContent = i18n.t('download_done', { name: fileName });
      showPrintGuide(book);
    })
    .catch((error) => {
      console.error(error);
      setIdle(generateEl, generateEl.dataset.idle || 'btn_generate');
      showActionError('generate_error');
    });
}

/**
 * After a download, the steps between the file and the bound book for these exact settings: print
 * at actual size, check the first sheet's back, then fold and gather. Gone once a setting changes.
 * @param {import('../book').Book} book
 */
function showPrintGuide(book) {
  const folds = Math.log2(book.per_sheet) - 1;
  const fold = i18n.t(folds === 1 ? 'fold_once' : 'fold_times', { n: folds });
  const gatherKeys = {
    standardsig: 'gather_signatures',
    customsig: 'gather_custom',
    booklet: 'gather_booklet',
    perfect: 'gather_perfect',
  };
  const steps = [
    i18n.t(book.duplex ? 'print_test_duplex' : 'print_test_single'),
    book.duplex && i18n.t('print_rest'),
    i18n.t(gatherKeys[book.format] ?? 'gather_single_sheet', {
      fold,
      n: book.sigsize,
      list: (book.signatureconfig ?? []).join(', '),
    }),
  ];
  document
    .getElementById('print_steps')
    .replaceChildren(
      ...steps
        .filter(Boolean)
        .map((text) => Object.assign(document.createElement('li'), { textContent: text }))
    );
  const guide = document.getElementById('print_guide');
  guide.hidden = false;
  guide.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

let refreshTimer;

/**
 * Keeps a preview on screen in step with the settings: it dims at once, then is imposed again
 * once the book is laid out and the changes settle, so it never shows a setup no longer chosen.
 * @param {import('../book').Book} book
 * @param {Promise<unknown>} laidOut - resolves when the book reflects the new settings
 */
export function refreshPreview(book, laidOut) {
  const frame = document.getElementById('pdf');
  if (frame.style.display === 'none') return;
  frame.classList.add('is-stale');
  document.getElementById('preview_caption').textContent = i18n.t('preview_updating');
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    try {
      await laidOut;
      // closed meanwhile (a new file was dropped): nothing to keep in step
      if (frame.style.display !== 'none') await book.createoutputfiles(true, { scroll: false });
    } catch (error) {
      console.error(error);
      clearPreview();
    }
    frame.classList.remove('is-stale');
  }, 300);
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
