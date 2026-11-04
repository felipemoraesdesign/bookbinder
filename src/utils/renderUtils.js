// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { PAGE_SIZES } from '../constants';
import { handleSewingMarksCheckboxState } from './clickHandlers.js';
import { i18n } from '../i18n.js';
import { customSignatureError } from './customSignatures.js';

export function renderPageCount(book) {
  const pageCount = document.getElementById('page_count');
  if (book.sourcePageCount && book.pagecount !== book.sourcePageCount) {
    pageCount.innerText = `${book.pagecount} / ${book.sourcePageCount}`;
    return;
  }

  pageCount.innerText = book.pagecount;
}

export function renderInfoBox(book) {
  const totalSheets = document.getElementById('total_sheets');
  const sigCount = document.getElementById('sig_count');
  const sigArrange = document.getElementById('sig_arrange');
  const totalPages = document.getElementById('total_pages');

  if (book.book == null || book.book == undefined) return;

  const outputPages = book.book.pagelistdetails.reduce((acc, list) => {
    list.forEach((sublist) => (acc += sublist.length ? sublist.length : 1));
    return acc;
  }, 0);

  // The special layouts carry no per-signature sheet counts or placed pages, and perfect bound
  // treats every sheet as its own signature: show only the figures that hold for each (#92)
  const isWacky = !['booklet', 'perfect', 'standardsig', 'customsig'].includes(book.format);
  const hasSignatures = !isWacky && book.format !== 'perfect';
  const title = document.getElementById('summary_title');
  title.setAttribute('data-i18n', hasSignatures ? 'summary_title' : 'summary_title_sheets');
  title.textContent = i18n.t(title.getAttribute('data-i18n'));
  document.querySelector('.bookblock').hidden = !hasSignatures;
  sigCount.parentElement.hidden = !hasSignatures;
  totalPages.parentElement.hidden = isWacky;

  // Pages that won't print: the single-sheet zine always takes 8, and custom signatures that hold
  // fewer sheets than the pages fill leave the end of the book out
  const customCheck = renderCustomSignatureCheck(book.neededSheets);
  let warning = '';
  if (book.format === '8_zine' && book.pagecount > 8) {
    warning = i18n.t('zine_page_warning', { total: book.pagecount });
  } else if (customCheck?.kind === 'short') {
    warning = i18n.t('custom_sig_short', customCheck);
  }
  const summaryWarning = document.getElementById('summary_warning');
  summaryWarning.hidden = !warning;
  summaryWarning.textContent = warning;

  // the figures that matter most, kept in the action bar pinned to the bottom of a phone screen
  document.getElementById('action_summary').textContent = [
    `${i18n.t('total_sheets')} ${book.book.sheets}`,
    hasSignatures && `${i18n.t('num_signatures')} ${book.book.sigconfig.length}`,
  ]
    .filter(Boolean)
    .join(' · ');

  totalSheets.innerText = book.book.sheets;
  sigCount.innerText = book.book.sigconfig.length;
  sigArrange.innerText = book.book.sigconfig.join(', ');
  totalPages.innerText = outputPages;
  if (hasSignatures) {
    renderSignatureBlock(document.getElementById('sig_visual'), book.book.sigconfig);
  }
}

/**
 * Says under the custom signatures field what it means: a typo, or sheets that leave the end of
 * the book out (both marked invalid) or add blank pages. Only while custom signatures are chosen.
 * @param {number} [neededSheets] - sheets the pages fill, once a PDF is laid out
 * @returns the check, for the summary's warning
 */
export function renderCustomSignatureCheck(neededSheets) {
  const field = document.querySelector('input[name="custom_sig"]');
  const hint = document.getElementById('custom_sig_hint');
  const check = document.getElementById('customsig').checked
    ? customSignatureError(field.value, neededSheets)
    : null;
  const invalid = check?.kind === 'syntax' || check?.kind === 'short';
  field.setAttribute('aria-invalid', invalid);
  hint.classList.toggle('is-error', invalid);
  if (check) {
    hint.removeAttribute('data-i18n');
    hint.textContent = i18n.t(`custom_sig_${check.kind}`, check);
  } else {
    hint.setAttribute('data-i18n', 'custom_sig_tooltip');
    hint.textContent = i18n.t('custom_sig_tooltip');
  }
  return check;
}

/**
 * Draws the signatures as a pile of folded cadernos in oblique view, like a bookbinding manual:
 * the head in front with each fold rounded on the left, the fore-edge on the right, the first page on top.
 * @param {HTMLElement} container
 * @param {number[]} sigconfig sheets per signature
 */
export function renderSignatureBlock(container, sigconfig) {
  // redraw only when the arrangement changes, so unrelated settings don't replay the animation
  const key = sigconfig.join(',');
  if (container.dataset.config === key) return;
  container.dataset.config = key;
  const length = 150; // the head, seen from the front
  const [dx, dy] = [34, 17]; // the page's depth, receding up and to the right
  const sheets = sigconfig.reduce((sum, n) => sum + n, 0);
  // big books shrink to about 72px tall
  const unit = Math.min(1, 72 / (sheets * 1.8 + sigconfig.length * 2));
  const x = 1 + length;
  let y = dy + 1;
  const cadernos = sigconfig.map((n, i) => {
    const t = (n * 1.8 + 2) * unit;
    const r = Math.min(t / 2, 5);
    const page = i === 0 ? `<path d="M1 ${y}L${1 + dx} 1H${x + dx}L${x} ${y}Z"/>` : '';
    // one line per sheet on the fore-edge, while they are far enough apart to read
    const leaves =
      t / n < 2
        ? ''
        : Array.from(
            { length: n - 1 },
            (_, k) => `<path class="leaf" d="M${x} ${y + ((k + 1) * t) / n}l${dx} ${-dy}"/>`
          ).join('');
    const caderno =
      `<g style="--i:${sigconfig.length - 1 - i}">${page}` +
      `<path d="M${x} ${y}H${1 + r}A${r} ${r} 0 0 0 1 ${y + r}V${y + t - r}A${r} ${r} 0 0 0 ${1 + r} ${y + t}H${x}Z"/>` +
      `<path d="M${x} ${y}l${dx} ${-dy}v${t}l${-dx} ${dy}Z"/>${leaves}</g>`;
    y += t;
    return caderno;
  });
  const width = x + dx + 1;
  const height = y + 1;
  container.innerHTML = `<svg class="pile" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="stroke-width:${Math.max(0.6, Math.min(1, unit * 1.5))}">${cadernos.join('')}</svg>`;
}

/**
 * Expects a data object describing the overall page layout info:
 *
 */
export function updatePageLayoutInfo(info) {
  document.getElementById('show_layout_info').style.display = 'flex';
  console.log('So much info from updatePageLayoutInfo: ', info);
  const needsRotation =
    info.dimensions.layout.rotations[0] == -90 ||
    info.dimensions.layout.rotations[0] == 90 ||
    info.dimensions.layout.rotations[0][0] == -90 ||
    info.dimensions.layout.rotations[0][0] == 90;
  //   Paper size: ${info.papersize[0]}, ${info.papersize[1]}<BR>
  const paperDims = info.dimensions.layoutCell;
  const pdfDims = [info.dimensions.xPdfWidthFunc(), info.dimensions.yPdfHeightFunc()];

  const scale = Math.min(
    Math.min(250 / paperDims[0], 250 / paperDims[1]),
    Math.min(250 / pdfDims[0], 250 / pdfDims[1])
  );

  let dims = [paperDims[0] * scale, paperDims[1] * scale];
  let displayDiv = document.getElementById('grid_layout_preview'); // blue box
  displayDiv.style.width = `${dims[0]}px`;
  displayDiv.style.height = `${dims[1]}px`;

  dims = [pdfDims[0] * scale, pdfDims[1] * scale];
  displayDiv = document.getElementById('pdf_on_page_layout_preview'); // orange box
  displayDiv.style.width = `${dims[0]}px`;
  displayDiv.style.height = `${dims[1]}px`;

  dims = [info.dimensions.xBindingShiftFunc() * scale, info.dimensions.yTopShiftFunc() * scale];
  displayDiv.style.margin = `${dims[1]}px ${dims[0]}px`;

  const locale = i18n.locale === 'pt' ? 'pt-BR' : 'en';
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const mm = (pt, format = decimal) => format.format((pt * 25.4) / 72);
  // whole millimetres first, then the same size in pt to check against a layout app
  const setSize = (id, [width, height]) => {
    const inPt = document.createElement('span');
    inPt.className = 'unit-alt';
    inPt.textContent = ` · ${decimal.format(width)} × ${decimal.format(height)} pt`;
    document
      .getElementById(id)
      .replaceChildren(`${mm(width, whole)} × ${mm(height, whole)} mm`, inPt);
  };

  const { rows, cols } = info.dimensions.layout;
  const [scaleX, scaleY] = info.dimensions.pdfScale;
  document.getElementById('page_grid_layout').textContent = `${rows} × ${cols}`;
  setSize('page_grid_dimensions', paperDims);
  setSize('pdf_source_dimensions', [info.cropbox.width, info.cropbox.height]);
  setSize('pdf_page_dimensions', pdfDims);
  document.getElementById('pdf_offset_dimensions').textContent = [
    `${i18n.t('binding_margin')} ${mm(info.dimensions.xBindingShiftFunc())} mm`,
    `${i18n.t('top_margin')} ${mm(info.dimensions.yTopShiftFunc())} mm`,
    `${i18n.t('fore_edge_margin')} ${mm(info.dimensions.xForeEdgeShiftFunc())} mm`,
    `${i18n.t('bottom_margin')} ${mm(info.dimensions.yBottomShiftFunc())} mm`,
  ].join('\n');
  const stretched = Math.abs(scaleX - scaleY) > 0.01;
  document.getElementById('pdf_scale_dimensions').textContent = stretched
    ? `${percent.format(scaleX)} × ${percent.format(scaleY)}`
    : percent.format(scaleX);
  document.getElementById('pdf_page_rotation_info').textContent = i18n.t(
    needsRotation ? 'yes' : 'no'
  );

  // The numbers that matter, said as a binder would: how many pages share a side, and what
  // happens to their size, so a 350% enlargement is read before printing rather than after.
  const pages = rows * cols;
  const paper = paperName(document.getElementById('paper_size').value);
  let scaleKey = 'sheet_scale_same';
  if (stretched) scaleKey = 'sheet_scale_stretch';
  else if (scaleX > 1.02) scaleKey = 'sheet_scale_up';
  else if (scaleX < 0.98) scaleKey = 'sheet_scale_down';
  document.getElementById('sheet_summary').textContent = [
    i18n.t(pages === 1 ? 'sheet_lead_one' : 'sheet_lead', { n: pages, paper }),
    i18n.t(scaleKey, {
      pct: percent.format(scaleX),
      x: percent.format(scaleX),
      y: percent.format(scaleY),
    }),
    needsRotation ? i18n.t('sheet_rotated') : '',
  ]
    .filter(Boolean)
    .join(' ');
  const warning = document.getElementById('sheet_scale_warning');
  warning.hidden = Math.abs(scaleX - 1) < 0.1 && Math.abs(scaleY - 1) < 0.1;
  warning.textContent = i18n.t('sheet_scale_warning', {
    size: decimal.format(10 * Math.min(scaleX, scaleY)),
  });
  lastLayoutInfo = info;
}

let lastLayoutInfo = null;

/** Writes the sheet view again in the current language, once a PDF has been laid out. */
export function refreshPageLayoutInfo() {
  if (lastLayoutInfo) updatePageLayoutInfo(lastLayoutInfo);
}
// The sizes people print on most come first; the rest keep the library's order
const COMMON_PAPERS = ['A4', 'A5', 'A3', 'FLSA', 'SRA3', 'LETTER'];

// [size of one pt in the unit, decimals shown]
// the library's sizes are rounded pt, so whole millimetres read true (A4 · 210 × 297, not 209,9)
const UNITS = { mm: [25.4 / 72, 0], cm: [2.54 / 72, 1], in: [1 / 72, 2], pt: [1, 2] };

/**
 * A paper's readable name: its translation when it has one ("Carta", "Ofício"), otherwise the
 * constant made readable ("JIS_B5" → "JIS B5", "CROWN_QUARTO" → "Crown quarto").
 * @param {string} key - a PAGE_SIZES key
 */
export function paperName(key) {
  const translated = i18n.t(`paper_${key}`);
  if (translated !== `paper_${key}`) return translated;
  const words = key.replace(/^_/, '').split('_');
  // short words and words with digits are codes (A4, JIS, ARCH, B10); longer ones are names
  return words
    .map((word, i) => {
      if (word.length <= 4 || /\d/.test(word)) return word;
      return i === 0 ? word[0] + word.slice(1).toLowerCase() : word.toLowerCase();
    })
    .join(' ');
}

/** Labels each paper "A4 · 210 × 297 mm" in the chosen unit and the interface's number format. */
export function updatePaperSelectOptionsUnits() {
  const paperList = document.getElementById('paper_size');
  const unit = document.getElementById('paper_size_unit').value;
  const [perPt, decimals] = UNITS[unit] ?? UNITS.mm;
  const number = new Intl.NumberFormat(i18n.locale === 'pt' ? 'pt-BR' : 'en', {
    maximumFractionDigits: decimals,
  });
  for (const option of paperList.options) {
    const [width, height] = PAGE_SIZES[option.value];
    option.label = `${paperName(option.value)} · ${number.format(width * perPt)} × ${number.format(height * perPt)} ${unit}`;
  }
  for (const group of paperList.querySelectorAll('optgroup')) {
    group.label = i18n.t(group.dataset.label);
  }
}
export function updateAddOrRemoveCustomPaperOption() {
  const width = document.getElementById('paper_size_custom_width').value;
  const height = document.getElementById('paper_size_custom_height').value;
  const paperList = document.getElementById('paper_size');
  // a 0 or blank side would lay the pages out as NaN
  const validDimensions = Number(width) > 0 && Number(height) > 0;
  const customOpt = paperList.options.namedItem('CUSTOM');
  if (customOpt == null && !validDimensions) {
    // No custom option, no valid custom settings
  } else if (customOpt != null && !validDimensions) {
    // Need to remove custom option because no valid custom settings
    customOpt.remove();
  } else if (customOpt == null) {
    // no option but valid settings!
    const opt = document.createElement('option');
    opt.setAttribute('value', 'CUSTOM');
    opt.setAttribute('name', 'CUSTOM');
    PAGE_SIZES.CUSTOM = [Number(width), Number(height)];
    // listed with the common sizes and chosen: typing a size means you want to print on it
    paperList.querySelector('optgroup').prepend(opt);
    paperList.value = 'CUSTOM';
  } else {
    // valid option, valid dimensions -- lets just make sure they're up to date
    PAGE_SIZES.CUSTOM = [Number(width), Number(height)];
  }
}
export function renderPaperSelectOptions() {
  const paperList = document.getElementById('paper_size');
  const addGroup = (labelKey, keys) => {
    const group = document.createElement('optgroup');
    group.dataset.label = labelKey;
    group.append(...keys.map((key) => new Option(key, key, key === 'A4', key === 'A4')));
    paperList.append(group);
  };
  addGroup('paper_common', COMMON_PAPERS);
  addGroup(
    'paper_other',
    // 11 × 17 in is Tabloid under another name
    Object.keys(PAGE_SIZES).filter((key) => !COMMON_PAPERS.includes(key) && key !== '_11X17')
  );
  updatePaperSelectOptionsUnits();
}

/**
 * The single-sheet layouts pad their pages as folios: while one is chosen, the book-size choice
 * leaves the form (its panel is hidden by CSS) and comes back unchanged when a classic format is.
 */
export function renderWacky() {
  const isWacky = Boolean(document.querySelector('.wacky input[name="sig_format"]:checked'));
  document.querySelectorAll('#book_size input').forEach((input) => {
    input.disabled = isWacky;
  });
}

/** @param { import("../models/configuration").Configuration } configuration */
export function renderFormFromSettings(configuration) {
  // Clear all checked attributes
  document.querySelectorAll('[type=radio]').forEach((e) => {
    e.checked = false;
  });
  document.querySelectorAll('[type=checkbox]').forEach((e) => {
    e.checked = false;
  });

  // Set checkboxes
  if (configuration.paperRotation90) {
    document.querySelector("input[name='paper_rotation_90']").checked = true;
  }

  if (configuration.rotatePage) {
    document.querySelector("input[name='rotate_page']").checked = true;
  }

  if (configuration.cropMarks) {
    document.querySelector("input[name='cropmarks']").checked = true;
  }

  if (configuration.sigOrderMarks) {
    document.querySelector("input[name='sig_order_marks']").checked = true;
  }

  if (configuration.pdfEdgeMarks) {
    document.querySelector("input[name='pdf_edge_marks']").checked = true;
  }

  if (configuration.cutMarks) {
    document.querySelector("input[name='cutmarks']").checked = true;
  }

  // Set radio options
  document.querySelector(`input[name="sig_format"][value="${configuration.sigFormat}"]`).checked =
    true;
  document.querySelector(
    `input[name="wacky_spacing"][value="${configuration.wackySpacing}"]`
  ).checked = true;

  // Set french link stitches settings
  handleSewingMarksCheckboxState(configuration.sewingMarksEnabled);
  document.querySelector('input[name="add_sewing_marks_checkbox"]').checked =
    configuration.sewingMarksEnabled;
  document.querySelector('select[name="sewing_mark_locations"]').value =
    configuration.sewingMarkLocation;
  document.querySelector('input[name="sewing_marks_margin_pt"]').value =
    configuration.sewingMarksMarginPt;
  document.querySelector('input[name="sewing_marks_amount"]').value =
    configuration.sewingMarksAmount;
  document.querySelector('input[name="sewing_marks_tape_width_pt"]').value =
    configuration.sewingMarksTapeWidthPt;

  // Set freeform inputs
  document.querySelector('input[name="main_fore_edge_padding_pt"]').value =
    configuration.mainForeEdgePaddingPt;
  document.querySelector('input[name="binding_edge_padding_pt"]').value =
    configuration.bindingEdgePaddingPt;
  document.querySelector('input[name="top_edge_padding_pt"]').value =
    configuration.topEdgePaddingPt;
  document.querySelector('input[name="bottom_edge_padding_pt"]').value =
    configuration.bottomEdgePaddingPt;
  document.querySelector('input[name="fore_edge_padding_pt"]').value =
    configuration.foreEdgePaddingPt;
  document.querySelector('input[name="flyleafs"]').value = configuration.flyleafs;
  document.querySelector('input[name="page_range"]').value = configuration.pageRange;

  // Set select options
  document.querySelector('select[name="source_rotation"]').value = configuration.sourceRotation;
  document.querySelector(`input[name="pagelayout"][value="${configuration.pageLayout}"]`).checked =
    true;
  document.querySelector('select[name="page_scaling"]').value = configuration.pageScaling;
  document.querySelector('select[name="page_positioning"]').value = configuration.pagePositioning;
  document.querySelector('select[name="print_file"]').value = configuration.printFile;
  document.querySelector('select[name="paper_size"]').value = configuration.paperSize;
  document.querySelector('select[name="paper_size_unit"]').value = configuration.paperSizeUnit;
  document.querySelector(
    `input[name="printer_type"][value="${configuration.printerType}"]`
  ).checked = true;

  // Set options which are not always present
  if (
    configuration.paperSize === 'CUSTOM' &&
    configuration.paperSizeCustomHeight !== undefined &&
    configuration.paperSizeCustomWidth !== undefined
  ) {
    document.querySelector('input[name="paper_size_custom_height"]').value =
      configuration.paperSizeCustomHeight;
    document.querySelector('input[name="paper_size_custom_width"]').value =
      configuration.paperSizeCustomWidth;
    updateAddOrRemoveCustomPaperOption();
    updatePaperSelectOptionsUnits();
    document.querySelector('select[name="paper_size"]').value = 'CUSTOM';
  }

  if (configuration.sigFormat == 'customsig') {
    document.querySelector("input[name='custom_sig']").value = configuration.customSigLength;
  } else {
    document.querySelector("input[name='sig_length']").value = configuration.sigLength;
  }

  // A saved single-sheet layout opens its group, so the chosen format is in view
  if (document.querySelector('.wacky input[name="sig_format"]:checked')) {
    document.getElementById('single_sheet').open = true;
  }

  // Hide and show elements based on configuration
  const sourceRotationExamples = Array.from(
    document.getElementsByClassName('source_rotation_example')
  );
  const selectedValue = `${configuration.sourceRotation}_example`;
  sourceRotationExamples.forEach((example) => {
    example.style.display = example.id === selectedValue ? 'flex' : 'none';
  });
}

/**
 * Loads a URL in the preview frame without adding a step to the browser's history (setting its
 * src would, so Back would page through old previews), and frees the previous preview's blob.
 * @param {HTMLIFrameElement} frame
 * @param {string} url
 */
export function showInPreviewFrame(frame, url) {
  if (frame.dataset.blob) URL.revokeObjectURL(frame.dataset.blob);
  frame.dataset.blob = url.startsWith('blob:') ? url : '';
  frame.contentWindow.location.replace(url);
}

export function clearPreview() {
  const previewFrame = document.getElementById('pdf');
  previewFrame.style.display = 'none';
  document.getElementById('preview_caption').hidden = true;
  showInPreviewFrame(previewFrame, 'about:blank');
}
