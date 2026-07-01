'use client'

import { useLocale, setLocale } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

/** 한 / EN pill toggle. Persists to a cookie and reloads so SSR matches. */
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale()
  return (
    <div className={cn('flex items-center gap-0.5 rounded-full border border-border bg-card/60 p-0.5 text-xs', className)}>
      <button
        onClick={() => locale !== 'ko' && setLocale('ko')}
        className={cn('rounded-full px-2 py-0.5 font-bold transition', locale === 'ko' ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        한
      </button>
      <button
        onClick={() => locale !== 'en' && setLocale('en')}
        className={cn('rounded-full px-2 py-0.5 font-bold transition', locale === 'en' ? 'bg-gold text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        EN
      </button>
    </div>
  )
}
