'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'

type Locale = 'en' | 'fr'

/**
 * Toggles between English and French by writing a `locale` cookie and
 * doing a full-page reload so the server re-reads the locale on next request.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale
  const [isPending, startTransition] = useTransition()

  function setLocale(next: Locale) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`
    startTransition(() => {
      window.location.reload()
    })
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-full border p-0.5 text-xs font-semibold',
        'border-black/10 bg-black/4 dark:border-white/10 dark:bg-white/6',
        isPending && 'pointer-events-none opacity-60',
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
              ? 'bg-gold-600 text-brand-900 shadow-sm'
              : 'text-brand-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-white',
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
