// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { pageMetadata } from '../app/pageMetadata'
import { i18n, LANGUAGE_STORAGE_KEY, setLanguage, t } from './index'
import { drawerIssueMessage } from './drawerIssues'
import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import nl from './locales/nl.json'

const placeholders = (text: string) =>
  [...text.matchAll(/\{\{\s*(\w+)/g)].map((match) => match[1]).sort()

afterEach(() => {
  setLanguage('en')
  localStorage.clear()
})

describe.each(Object.entries({ nl, de, fr }))('%s locale', (_, locale) => {
  const source = en as Record<string, string>
  const translated = locale as Record<string, string>

  it('has exactly the same keys as English', () => {
    expect(Object.keys(translated).sort()).toStrictEqual(
      Object.keys(source).sort(),
    )
  })

  it('keeps every placeholder and leaves nothing empty', () => {
    for (const key of Object.keys(source)) {
      expect(translated[key], key).toBeTruthy()
      expect(placeholders(translated[key]!), key).toStrictEqual(
        placeholders(source[key]!),
      )
    }
  })
})

describe('language handling', () => {
  it('switches language, remembers the choice and marks the document', () => {
    setLanguage('nl')
    expect(t('nav.cutList')).toBe('Zaaglijst')
    expect(document.documentElement.lang).toBe('nl')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('nl')
  })

  it('uses each language’s own plural rules', () => {
    setLanguage('fr')
    expect(t('count.cabinets', { count: 0 })).toBe('0 meuble')
    expect(t('count.cabinets', { count: 2 })).toBe('2 meubles')
    setLanguage('nl')
    expect(t('count.cabinets', { count: 0 })).toBe('0 kasten')
    expect(t('count.cabinets', { count: 1 })).toBe('1 kast')
  })

  it('formats half millimetres and thousands for each language', () => {
    setLanguage('de')
    expect(t('drawer.grooveLabel', { depth: 7.5 })).toContain('7,5')
    expect(t('canvas.totalWidth', { width: 2600 })).toContain('2.600')
    setLanguage('en')
    expect(t('drawer.grooveLabel', { depth: 7.5 })).toContain('7.5')
    expect(t('canvas.totalWidth', { width: 2600 })).toContain('2,600')
  })

  it('words domain drawer issues from their reason and values', () => {
    setLanguage('de')
    expect(
      drawerIssueMessage({
        code: 'invalid-drawer-design',
        reason: 'measurement',
        values: { field: 'wallThickness', minimum: 1 },
        message: 'Wall thickness must be a whole number of at least 1 mm.',
      }),
    ).toBe('Wandstärke muss eine ganze Zahl von mindestens 1 mm sein.')
  })

  it('keeps English metadata in step with the static build metadata', () => {
    expect(i18n.getFixedT('en')('meta.designer.title')).toBe(
      pageMetadata('/designer').title,
    )
    expect(i18n.getFixedT('en')('meta.cutList.description')).toBe(
      pageMetadata('/cut-list').description,
    )
    expect(i18n.getFixedT('en')('meta.notFound.title')).toBe(
      pageMetadata('/missing').title,
    )
  })
})
