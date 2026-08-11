import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import arTranslation from './locales/ar.json';

const isBrowser = typeof window !== 'undefined';

const i18nInstance = i18n.createInstance();

const baseOptions = {
  resources: {
    en: { translation: enTranslation },
    ar: { translation: arTranslation },
  },
  fallbackLng: 'en',
  debug: false,
  interpolation: { escapeValue: false },
};

if (isBrowser) {
  i18nInstance
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...baseOptions,
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      }
    });
} else {
  i18nInstance
    .use(initReactI18next)
    .init(baseOptions);
}

export default i18nInstance;
