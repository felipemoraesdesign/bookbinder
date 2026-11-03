// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { PDFDocument } from '@cantoo/pdf-lib';
import { impose } from './impose';
import { Signatures } from './signatures';

// An 8-page A5 booklet, like a church bulletin, folded from 2 A4 sheets
const A5 = [419.53, 595.28];
const BULLETIN = {
  paperSize: 'A4',
  pageLayout: 'folio',
  printerType: 'duplex',
  sigFormat: 'booklet',
  flyleafs: 0,
  printFile: 'aggregated',
};

async function a5Pdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage(A5).drawText(String(i + 1), { x: 50, y: 50 });
  // base64, because pdf-lib rejects a Node Buffer under jsdom
  return Buffer.from(await doc.save()).toString('base64');
}

describe('impose', () => {
  it('turns an 8-page A5 bulletin into one duplex PDF of 2 A4 sheets', async () => {
    const files = await impose(await a5Pdf(8), BULLETIN, { name: 'Boletim 140' });
    expect(files.map((f) => f.name)).toEqual(['Boletim 140 - imposição.pdf']);

    const out = await PDFDocument.load(Buffer.from(files[0].bytes).toString('base64'));
    expect(out.getPageCount()).toBe(4); // 2 sheets, front and back
    const { width, height } = out.getPage(0).getSize();
    expect([Math.round(Math.min(width, height)), Math.round(Math.max(width, height))]).toEqual([
      595, 842,
    ]);
  });

  it('nests the pages for saddle stitching: each side holds a pair that adds up to 9', () => {
    const sig = new Signatures([0, 1, 2, 3, 4, 5, 6, 7], 8, 4);
    sig.createsigconfig();
    const pages = sig.pagelistdetails[0].flat().map((p) => p.info + 1);
    expect([...pages].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 0; i < pages.length; i += 2) expect(pages[i] + pages[i + 1]).toBe(9);
  });

  it('pads a 6-page PDF with blank pages to a whole sheet', async () => {
    const files = await impose(await a5Pdf(6), BULLETIN);
    const out = await PDFDocument.load(Buffer.from(files[0].bytes).toString('base64'));
    expect(out.getPageCount()).toBe(4);
  });
});
