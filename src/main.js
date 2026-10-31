// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { Book } from './book.js';
import { loadForm } from './utils/formUtils.js';
import { handleFileChange, handleInputChange } from './utils/changeHandlers.js';
import {
  handleGenerateClick,
  handlePreviewClick,
  handleResetSettingsClick,
  handleSewingMarksCheckboxState,
  setLabel,
} from './utils/clickHandlers.js';
import { renderPaperSelectOptions } from './utils/renderUtils.js';
import { pageRangeError } from './utils/pageRange.js';
import { i18n } from './i18n.js';

let onLanguageChange = () => {};

const markActiveLanguage = (lang) => {
  for (const code of ['pt', 'en']) {
    const btn = document.getElementById(`btn-lang-${code}`);
    btn.classList.toggle('active', lang === code);
    btn.setAttribute('aria-pressed', lang === code);
  }
};

window.setLanguage = (lang) => {
  i18n.setLanguage(lang);
  markActiveLanguage(lang);
  onLanguageChange();
};

// Sets translated text and keeps the key, so a later language switch re-translates it; a null key clears it.
const setMessage = (el, key) => {
  if (key) {
    el.setAttribute('data-i18n', key);
    el.textContent = i18n.t(key);
  } else {
    el.removeAttribute('data-i18n');
    el.textContent = '';
  }
};

const formatSize = (bytes) => {
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.ceil(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

window.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();
  markActiveLanguage(i18n.locale);

  // render dynamic content
  renderPaperSelectOptions();
  const configuration = loadForm();

  // grab DOM elements
  const generate = document.getElementById('generate');
  const preview = document.getElementById('preview');
  const resetSettings = document.getElementById('reset_settings');
  const bookbinderForm = document.getElementById('bookbinder');
  const fileInput = document.getElementById('input_file');
  const fileError = document.getElementById('file_error');
  const fileName = document.getElementById('file_name');
  const fileMeta = document.getElementById('file_meta');
  const pageRange = document.getElementById('page_range');
  const pageRangeHelp = document.getElementById('page_range_help');
  const setupSummary = document.getElementById('setup_summary');
  const inputs = document.querySelectorAll('input, select');
  const sourceRotation = document.getElementById('source_rotation');
  const sewingMarks = document.getElementById('add_sewing_marks_checkbox');
  const sourceRotationExamples = Array.from(
    document.getElementsByClassName('source_rotation_example')
  );

  // spin up a book to pass to listeners
  const book = new Book(configuration);

  // Returning users see the setup their next PDF will get, so they can drop it without opening the panel.
  const renderSetupSummary = () => {
    const format = bookbinderForm.querySelector('input[name="sig_format"]:checked');
    const printer = bookbinderForm.querySelector('input[name="printer_type"]:checked');
    const parts = [
      format?.closest('.choice')?.querySelector('.choice-title')?.textContent,
      format?.value === 'standardsig' &&
        `${bookbinderForm.elements.sig_length.value} ${i18n.t('sheets_each')}`,
      bookbinderForm.elements.paper_size.value,
      printer?.nextElementSibling?.textContent.toLocaleLowerCase(i18n.locale),
    ].filter(Boolean);
    setupSummary.textContent = `${i18n.t('setup_current')} ${parts.join(', ')}`;
  };

  const validatePageRange = () => {
    const error = pageRangeError(pageRange.value, book.currentdoc?.getPageCount());
    pageRange.setAttribute('aria-invalid', Boolean(error));
    pageRangeHelp.classList.toggle('is-error', Boolean(error));
    setMessage(pageRangeHelp, error ? `page_range_${error}` : 'page_range_help');
  };

  onLanguageChange = renderSetupSummary;
  renderSetupSummary();

  // add event listeners to grabbed elements
  inputs.forEach((input) => {
    input.addEventListener('change', () => {
      handleInputChange(book, bookbinderForm);
      renderSetupSummary();
    });
  });
  pageRange.addEventListener('input', validatePageRange);

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessage(fileError, null);
    document.body.dataset.state = 'reading';
    fileName.textContent = file.name;
    fileMeta.textContent = i18n.t('file_reading');
    generate.setAttribute('disabled', true);
    preview.setAttribute('disabled', true);
    handleFileChange(e, book)
      .then(() => {
        document.body.dataset.state = 'loaded';
        fileMeta.textContent = formatSize(file.size);
        generate.removeAttribute('disabled');
        preview.removeAttribute('disabled');
        validatePageRange();
      })
      .catch((error) => {
        console.error(error);
        document.body.dataset.state = 'empty';
        fileInput.value = '';
        setMessage(fileError, 'file_error');
      });
  });

  // Lift a figure for a moment when its value changes, so a setting's effect on the result is visible.
  document.querySelectorAll('.stats dd').forEach((figure) => {
    new MutationObserver(() => {
      if (figure.dataset.value === figure.textContent) return;
      figure.dataset.value = figure.textContent;
      figure.classList.remove('is-updated');
      void figure.offsetWidth; // restart the animation
      figure.classList.add('is-updated');
    }).observe(figure, { childList: true, characterData: true, subtree: true });
  });

  // Drag-and-drop lands on the transparent file input; this only adds the visual cue.
  const dropzone = document.getElementById('dropzone');
  ['dragenter', 'dragover'].forEach((type) =>
    dropzone.addEventListener(type, () => dropzone.classList.add('is-dragging'))
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropzone.addEventListener(type, () => dropzone.classList.remove('is-dragging'))
  );
  // Stop the browser from navigating away when a PDF misses the drop target.
  ['dragover', 'drop'].forEach((type) =>
    window.addEventListener(type, (e) => {
      if (e.target !== fileInput) e.preventDefault();
    })
  );
  generate.addEventListener('click', () => handleGenerateClick(generate, book));
  preview.addEventListener('click', () => handlePreviewClick(preview, book));

  // Resetting wipes saved settings, so it takes a second click within 3 s.
  let resetTimer;
  resetSettings.addEventListener('click', () => {
    clearTimeout(resetTimer);
    if (!resetSettings.classList.contains('is-armed')) {
      resetSettings.classList.add('is-armed');
      setLabel(resetSettings, 'btn_reset_confirm');
      resetTimer = setTimeout(() => {
        resetSettings.classList.remove('is-armed');
        setLabel(resetSettings, 'btn_reset');
      }, 3000);
      return;
    }
    resetSettings.classList.remove('is-armed');
    console.log('Resetting settings...');
    bookbinderForm.reset();
    handleResetSettingsClick(book);
    handleInputChange(book, bookbinderForm);
    renderSetupSummary();
    validatePageRange();
    setLabel(resetSettings, 'btn_reset_done');
    resetTimer = setTimeout(() => setLabel(resetSettings, 'btn_reset'), 2000);
  });

  sourceRotation.addEventListener('change', (e) => {
    const selectedValue = `${e.target.value}_example`;
    sourceRotationExamples.forEach((example) => {
      example.style.display = example.id === selectedValue ? 'flex' : 'none';
    });
  });
  sewingMarks.addEventListener('change', (e) => {
    const willBeEnabled = e.srcElement.checked;
    handleSewingMarksCheckboxState(willBeEnabled);
  });
});
