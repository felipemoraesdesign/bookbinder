// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { PDFDocument } from '@cantoo/pdf-lib';
import { Book } from './book.js';
import { i18n } from './i18n.js';
import { schema } from './models/configuration.js';

/**
 * Imposes a PDF without the interface, for other programs to use Miolo as a library.
 * Takes the same settings as the interface (see models/configuration.js); missing ones use the defaults.
 *
 * @param {Uint8Array | ArrayBuffer} pdfBytes - the PDF in reading order
 * @param {Partial<import("./models/configuration.js").Configuration>} [settings]
 * @param {{ name?: string }} [options] - name: base for the output file names
 * @returns {Promise<{ name: string, bytes: Uint8Array }[]>} the PDFs the download would hold
 */
export async function impose(pdfBytes, settings = {}, { name = 'Miolo' } = {}) {
  if (!Object.keys(i18n.translations).length) await i18n.init(); // file names come from the locale
  const book = new Book(schema.parse(settings));
  book.inputpdf = `${name}.pdf`;
  book.input = pdfBytes;
  book.currentdoc = await PDFDocument.load(pdfBytes);
  book.fixBlankPages();
  await book.createpages();
  await book.buildOutputs(false);
  const files = book.zip.file(/\.pdf$/);
  return Promise.all(
    files.map(async (f) => ({ name: f.name, bytes: await f.async('uint8array') }))
  );
}
