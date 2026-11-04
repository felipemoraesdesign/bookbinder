// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { calculateDimensions, calculateLayout } from './layout.js';

/**
 * The first sheet of the first signature, side by side, laid out exactly as writepages() lays the
 * PDF: the same page lists and the same positions, so the drawing can't disagree with the file.
 * @param {import('../book.js').Book} book
 * @returns {{ paper: number[], cells: object[], sides: object[][] } | null}
 */
export function firstSheet(book) {
  const [frontList, backList] = book.book?.pagelistdetails?.[0] ?? [];
  if (!frontList?.length) return null;
  const perSide = book.per_sheet / 2;
  const dimensions = calculateDimensions(book);
  const [cellWidth, cellHeight] = dimensions.layoutCell;
  const [pdfWidth, pdfHeight] = dimensions.rawPdfSize;
  const [sx, sy] = dimensions.pdfScale;

  const side = (pages, back) => {
    const positions =
      book.alt_layout && !back ? calculateLayout(book) : calculateLayout(book, true);
    return pages.slice(0, perSide).map((page, i) => {
      const { x, y, rotation } = positions[i];
      // pdf-lib turns the page counterclockwise about (x, y)
      const angle = (rotation * Math.PI) / 180;
      const corner = (u, v) => [
        x + u * Math.cos(angle) - v * Math.sin(angle),
        y + u * Math.sin(angle) + v * Math.cos(angle),
      ];
      const w = pdfWidth * sx;
      const h = pdfHeight * sy;
      return {
        number: page.info === 'b' || page.info === undefined ? null : page.info + 1,
        rotation,
        corners: [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)],
        center: corner(w / 2, h / 2),
      };
    });
  };

  // each layout row and column is a cell; a quarter-turned page takes the cell on its side
  const rotations = dimensions.layout.rotations;
  const cells = rotations.flatMap((row, i) =>
    row.map((rotation, j) => {
      const [w, h] = Math.abs(rotation) === 90 ? [cellHeight, cellWidth] : [cellWidth, cellHeight];
      return { x: j * w, y: i * h, w, h };
    })
  );

  return {
    paper: book.papersize,
    cells,
    sides: [side(frontList, false), side(backList ?? [], true)],
  };
}

/** One side of the sheet as SVG, in paper points with y flipped to the screen's. */
export function sideSvg({ paper, cells }, pages, label, describe) {
  const [W, H] = paper;
  // about the size of a hand-held sheet on screen, landscape or portrait (inline: icons size every svg)
  const fit = Math.min(160 / W, 190 / H);
  const flip = ([x, y]) => `${x.toFixed(1)},${(H - y).toFixed(1)}`;
  const smallest = Math.min(...cells.map((c) => Math.min(c.w, c.h)));
  const size = Math.max(10, smallest * 0.42);
  // internal cell edges are the folds
  const folds = new Set();
  cells.forEach(({ x, y, w, h }) => {
    if (x > 0.5) folds.add(`M${x.toFixed(1)} 0V${H}`);
    if (y > 0.5) folds.add(`M0 ${(H - y).toFixed(1)}H${W}`);
    if (x + w < W - 0.5) folds.add(`M${(x + w).toFixed(1)} 0V${H}`);
    if (y + h < H - 0.5) folds.add(`M0 ${(H - y - h).toFixed(1)}H${W}`);
  });
  const slots = pages
    .map(({ number, corners, center, rotation }) => {
      if (number === null) return '';
      const [cx, cy] = [center[0], H - center[1]];
      return (
        `<polygon class="sd-pdf" points="${corners.map(flip).join(' ')}"/>` +
        `<text class="sd-num" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-size="${size.toFixed(1)}" ` +
        `transform="rotate(${-rotation} ${cx.toFixed(1)} ${cy.toFixed(1)})">${number}</text>`
      );
    })
    .join('');
  return (
    `<figure class="sd-side"><svg viewBox="0 0 ${W} ${H}" style="width:${(W * fit).toFixed(0)}px;height:${(H * fit).toFixed(0)}px" role="img" aria-label="${describe(pages.map((p) => p.number).filter(Boolean))}">` +
    `<rect class="sd-paper" width="${W}" height="${H}"/>${slots}` +
    `<path class="sd-fold" d="${[...folds].join('')}"/></svg>` +
    `<figcaption>${label}</figcaption></figure>`
  );
}
