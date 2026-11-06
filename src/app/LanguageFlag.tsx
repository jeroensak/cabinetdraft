import type { ReactNode } from 'react'
import type { Language } from '../i18n'

const stripes = (colours: string[], vertical = false) =>
  colours.map((fill, index) => {
    const share = 1 / colours.length
    return vertical ? (
      <rect
        key={fill}
        x={index * share * 20}
        width={share * 20}
        height="14"
        fill={fill}
      />
    ) : (
      <rect
        key={fill}
        y={index * share * 14}
        width="20"
        height={share * 14}
        fill={fill}
      />
    )
  })

// Drawn rather than emoji: Windows browsers show emoji flags as two letters.
const flags: Record<Language, ReactNode> = {
  en: (
    <>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="2.6" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#c8102e" strokeWidth="1" />
      <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.4" />
      <path d="M10 0v14M0 7h20" stroke="#c8102e" strokeWidth="2.6" />
    </>
  ),
  nl: stripes(['#ae1c28', '#fff', '#21468b']),
  de: stripes(['#000', '#dd0000', '#ffce00']),
  fr: stripes(['#002395', '#fff', '#ed2939'], true),
}

export function LanguageFlag({ language }: { language: Language }) {
  return (
    <svg className="language-flag" viewBox="0 0 20 14" aria-hidden="true">
      {flags[language]}
    </svg>
  )
}
