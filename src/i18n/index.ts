import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';
import es from './locales/es.json';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  de: { translation: de },
  ru: { translation: ru },
  ar: { translation: ar },
  fr: { translation: fr },
  es: { translation: es },
};

// SSR/SSG-safe: prerender (Node) ortamında localStorage YOK. typeof guard'ı
// olmadan module-load anında ReferenceError → build çöker. Prerender'da varsayılan
// 'tr' render edilir; istemcide RtlEffect + i18n gerçek dile geçer.
const _initialLng =
  (typeof localStorage !== 'undefined' && localStorage.getItem('preferred-language')) || 'tr';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: _initialLng,
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
