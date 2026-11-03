import en from './locales/en.json';
import pt from './locales/pt.json';

const translationsMap = { en, pt };

const attributeKeys = {
  'data-i18n-tooltip': 'aria-label',
  'data-i18n-placeholder': 'placeholder',
  'data-i18n-title': 'title',
  'data-i18n-alt': 'alt',
};

export const i18n = {
  locale: globalThis.localStorage?.getItem('bookbinder_lang') || 'pt',
  translations: {},

  async init() {
    this.translations = translationsMap[this.locale] || translationsMap.pt;
    this.translateDOM();
  },

  setLanguage(lang) {
    this.locale = lang;
    localStorage.setItem('bookbinder_lang', lang);
    this.translations = translationsMap[this.locale] || translationsMap.pt;
    this.translateDOM();
  },

  // fills {placeholders} in the text from vars, e.g. t('out_zip', { name })
  t(key, vars = {}) {
    const text = this.translations[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
  },

  translateDOM() {
    if (typeof document === 'undefined') return; // used as a library, outside a browser
    document.documentElement.lang = this.locale === 'pt' ? 'pt-BR' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (this.translations[key]) {
        el.innerHTML = this.translations[key];
      }
    });

    for (const [dataAttr, attr] of Object.entries(attributeKeys)) {
      document.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
        const key = el.getAttribute(dataAttr);
        if (this.translations[key]) {
          el.setAttribute(attr, this.translations[key]);
        }
      });
    }
  },
};
