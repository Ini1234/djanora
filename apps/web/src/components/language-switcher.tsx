'use client'

import { useLocale } from 'next-intl'
import { persistLocale } from '@/lib/persist-locale'
import { cn } from '@/lib/utils'

type Locale = 'en' | 'fr'

/**
 * Toggles between English and French by writing a `locale` cookie and
 * doing a full-page reload so the server re-reads the locale on next request.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale

  function setLocale(next: Locale) {
    persistLocale(next)
  }

  return (
    <div
      className={cn(
        'border-nav-border bg-hover flex items-center gap-0.5 rounded-full border p-0.5 text-xs font-semibold',
        className,
      )}
      aria-label="Language"
      role="group"
    >
      {(['en', 'fr'] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          className={cn(
            'rounded-full px-2.5 py-0.5 tracking-wide uppercase transition-all duration-150',
            locale === lang
              ? 'bg-primary text-primary-fg shadow-sm'
              : 'text-nav-muted hover:text-nav-fg',
          )}
          aria-pressed={locale === lang}
          aria-label={lang === 'en' ? 'English' : 'Français'}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}
