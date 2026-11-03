// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from '@cantoo/pdf-lib';
import { saveAs } from 'file-saver';
import { Book } from './book';
import { i18n } from './i18n';
import { schema } from './models/configuration';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

// The test environment has no localStorage, which the saved settings read
const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
});

// vitest runs from the repository root
const pdf = await readFile('docs/example_page_numbers.pdf');

/** Generates the download for the 120-page example PDF and returns the saved file's name and the files made. */
async function download(settings) {
  const book = new Book(schema.parse(settings));
  book.inputpdf = 'Meu Livro: v2.pdf';
  book.input = pdf;
  // base64, because pdf-lib rejects a Node Buffer under jsdom
  book.currentdoc = await PDFDocument.load(pdf.toString('base64'));
  await book.createpages();
  book.displayPreview = async () => {};
  await book.createoutputfiles(false);
  const [blob, name] = saveAs.mock.lastCall;
  return { book, blob, name, files: Object.keys(book.zip.files) };
}

describe('download', () => {
  beforeAll(() => i18n.init());
  beforeEach(() => saveAs.mockClear());

  it('zips the full file and one file per signature, named in the interface language', async () => {
    const { name, files } = await download({});
    expect(name).toBe('Meu Livro- v2 (imposição).zip');
    expect(files).toContain('Meu Livro- v2 - imposição.pdf');
    expect(files).toContain('cadernos/Meu Livro- v2 - caderno 1 de 8.pdf');
    expect(files).toContain('cadernos/Meu Livro- v2 - caderno 8 de 8.pdf');
    expect(files).toContain('configurações.txt');
  });

  it('pads signature numbers so 10 or more sort in order', async () => {
    const { files } = await download({ sigLength: 1, printFile: 'signatures' });
    expect(files).toContain('cadernos/Meu Livro- v2 - caderno 01 de 31.pdf');
    expect(files).toContain('cadernos/Meu Livro- v2 - caderno 31 de 31.pdf');
  });

  it('saves a lone duplex PDF as is, titled after its file', async () => {
    const { book, blob, name } = await download({ printFile: 'aggregated' });
    expect(name).toBe('Meu Livro- v2 - imposição.pdf');
    expect(blob.type).toBe('application/pdf');
    const saved = await PDFDocument.load(await book.zip.file(name).async('uint8array'));
    expect(saved.getTitle()).toBe('Meu Livro- v2 - imposição');
  });

  it('zips the front and back when printing in two passes', async () => {
    const { name, files } = await download({ printFile: 'aggregated', printerType: 'single' });
    expect(name).toBe('Meu Livro- v2 (imposição).zip');
    expect(files).toEqual(
      expect.arrayContaining([
        'Meu Livro- v2 - imposição - frente.pdf',
        'Meu Livro- v2 - imposição - verso.pdf',
      ])
    );
  });

  it('names special layouts after their label', async () => {
    const { name } = await download({ sigFormat: '8_zine' });
    expect(name).toBe('Meu Livro- v2 - Zine de folha única.pdf');
  });
});
