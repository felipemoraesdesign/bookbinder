// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Whether the download is a single PDF, saved as is, rather than a .zip.
 * Booklets, perfect bound and the special layouts always make one file per printing side.
 * @param {{ sigFormat: string, printFile: string, printerType: string }} settings
 * @returns {boolean}
 */
export function makesSinglePdf({ sigFormat, printFile, printerType }) {
  const choosesFiles = sigFormat === 'standardsig' || sigFormat === 'customsig';
  return printerType === 'duplex' && (!choosesFiles || printFile === 'aggregated');
}
