'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/vendors', label: 'Find Vendors' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#for-vendors', label: 'For Vendors' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed top-0 right-0 left-0 z-50 border-b border-[var(--nav-border)] bg-[var(--nav-bg)]">
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="font-display hover:text-muted text-foreground flex items-center gap-2 text-xl font-semibold transition-colors"
          aria-label="Djanora — home"
        >
          <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
            D
          </span>
          <span>Djanora</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden items-center gap-8 md:flex" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/sign-in" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn btn-primary btn-sm">
            Get started
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="rounded-md p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)] md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          'overflow-hidden border-t border-[var(--color-border)] bg-[var(--color-background)] transition-all duration-200 md:hidden',
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
        aria-hidden={!mobileOpen}
      >
        <ul className="flex flex-col gap-4 px-4 py-4" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-2">
            <Link
              href="/sign-in"
              className="btn btn-ghost btn-sm justify-start"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="btn btn-primary btn-sm"
              onClick={() => setMobileOpen(false)}
            >
              Get started
            </Link>
          </li>
        </ul>
      </div>
    </header>
  )
}
