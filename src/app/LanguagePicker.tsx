import { languages, setLanguage, useTranslation, type Language } from '../i18n'

export function LanguagePicker() {
  const { t, i18n } = useTranslation()
  return (
    <select
      className="language-picker"
      aria-label={t('header.language')}
      value={i18n.resolvedLanguage}
      onChange={(event) => setLanguage(event.target.value as Language)}
    >
      {languages.map((language) => (
        <option key={language.code} value={language.code} lang={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  )
}
