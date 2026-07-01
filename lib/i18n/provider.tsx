'use client'

import { createContext, useContext } from 'react'
import { tr, type Locale } from './dict'

const LocaleContext = createContext<Locale>('ko')

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

/** t(koString) → localized string. Korean is the identity; English is a lookup. */
export function useT() {
  const locale = useContext(LocaleContext)
  return (s: string) => tr(s, locale)
}

export function useLocale() {
  return useContext(LocaleContext)
}

/** Switch language: persist to the `lang` cookie and reload so SSR + client agree. */
export function setLocale(next: Locale) {
  if (typeof document === 'undefined') return
  document.cookie = `lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  window.location.reload()
}
