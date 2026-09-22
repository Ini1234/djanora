'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function AdminSubnav() {
  const pathname = usePathname()
  const t = useTranslations('admin')
  const links = [
    { href: '/admin', label: t('queue'), exact: true },
    { href: '/admin/vendors', label: t('vendors') },
    { href: '/admin/users', label: t('users') },
  ]

  return (
    <div
      className="border-b px-4 pt-6 sm:px-6 lg:px-8"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <h1
        className="font-display text-2xl font-semibold"
        style={{ color: 'var(--color-foreground)' }}
      >
        {t('title')}
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
        {t('subtitle')}
      </p>
      <nav className="mt-4 flex gap-4" aria-label={t('title')}>
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'border-b-2 pb-2 text-sm font-medium',
                active
                  ? 'border-[var(--color-brand-primary)] text-[var(--color-foreground)]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
