import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import nl from './locales/nl.json'

export { useTranslation } from 'react-i18next'

export const LANGUAGE_STORAGE_KEY = 'cabinet-designer:language'

/** Each language is named in itself, so it can be found whatever is selected. */
export const languages = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
] as const

export type Language = (typeof languages)[number]['code']

/** A saved choice wins, then the browser's language, then English. The choice is
 * an editor preference and never becomes part of Project JSON. */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      nl: { translation: nl },
      de: { translation: de },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    supportedLngs: languages.map((language) => language.code),
    load: 'languageOnly',
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // Only an explicit choice is remembered, so the browser's language can
      // still change until someone picks one.
      caches: [],
    },
  })

const syncDocumentLanguage = (language: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
syncDocumentLanguage(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', syncDocumentLanguage)

export function setLanguage(language: Language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    /* The language still applies for this visit. */
  }
  void i18n.changeLanguage(language)
}

/** For code outside React: the PDF, command errors and default names. */
export const t = i18n.t.bind(i18n)
export { i18n }
