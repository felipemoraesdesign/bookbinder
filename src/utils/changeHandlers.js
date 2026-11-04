// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { saveForm, updateRenderedForm } from './formUtils';
import {
  updatePaperSelectOptionsUnits,
  updateAddOrRemoveCustomPaperOption,
  clearPreview,
} from './renderUtils';

export function handleInputChange(book, bookbinderForm) {
  // first, so a newly typed custom size is listed, chosen and in PAGE_SIZES when the form is read
  updateAddOrRemoveCustomPaperOption();
  const formData = new FormData(bookbinderForm);
  const updatedConfiguration = saveForm(formData);
  book.update(updatedConfiguration);
  updatePaperSelectOptionsUnits(); // make sure this goes AFTER the Custom update!
  // resolves once the book is laid out again, so a preview can follow the new settings
  return book.inputpdf ? updateRenderedForm(book) : Promise.resolve();
}

export function handleFileChange(e, book) {
  clearPreview();
  const fileList = e.target.files;
  if (fileList.length === 0) return Promise.resolve();
  return book
    .openpdf(fileList[0])
    .then(() => updateRenderedForm(book))
    .catch((error) => {
      // openpdf sets the name before parsing; clear it so later setting changes don't render a broken doc
      book.inputpdf = null;
      throw error;
    });
}
