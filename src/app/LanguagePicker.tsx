import { languages, setLanguage, useTranslation, type Language } from '../i18n'
import { HeaderMenu } from './HeaderMenu'
import { LanguageFlag } from './LanguageFlag'

export function LanguagePicker() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage as Language
  return (
    <HeaderMenu
      label={t('header.language')}
      icon={<LanguageFlag language={current} />}
    >
      {languages.map((language) => (
        <button
          key={language.code}
          className="header-menu-item"
          role="menuitemradio"
          aria-checked={language.code === current}
          lang={language.code}
          onClick={() => setLanguage(language.code)}
        >
          <LanguageFlag language={language.code} />
          {language.label}
        </button>
      ))}
    </HeaderMenu>
  )
}
