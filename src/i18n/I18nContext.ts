import { createContext, useContext } from 'react';
import { he, en, type Lang, type Translations } from './translations';

interface I18nContextValue {
  t: Translations;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const I18nContext = createContext<I18nContextValue>({
  t: he,
  lang: 'he',
  setLang: () => {},
});

export function useT(): Translations {
  return useContext(I18nContext).t;
}

export function getTranslations(lang: Lang): Translations {
  return lang === 'en' ? en : he;
}
