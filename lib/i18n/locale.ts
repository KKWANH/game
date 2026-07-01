import 'server-only'

import { cookies } from 'next/headers'
import type { Locale } from './dict'

export const LOCALE_COOKIE = 'lang'

/** Current locale from the `lang` cookie (defaults to Korean). Server-side. */
export async function getLocale(): Promise<Locale> {
  const c = await cookies()
  return c.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'ko'
}
