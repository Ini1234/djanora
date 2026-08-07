'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '/vendors', label: 'Find Vendors' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#for-vendors', label: 'For Vendors' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isSignedIn } = useUser()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-background)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl font-semibold text-brand-800 hover:text-brand-600 transition-colors"
          aria-label="CaaS — home"
        >
          <span className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-bold">
            C
          </span>
          <span>CaaS</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth actions */}
        <div className="hidden md:flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-brand-700 hover:text-brand-600 transition-colors"
              >
                Dashboard
              </Link>
              <UserButton />
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-brand-700 hover:text-brand-600 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-medium bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 rounded-full transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-md text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-border)] transition-colors"
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
          'md:hidden border-t border-[var(--color-border)] bg-[var(--color-background)] overflow-hidden transition-all duration-200',
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
        aria-hidden={!mobileOpen}
      >
        <ul className="px-4 py-4 flex flex-col gap-4" role="list">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="pt-2 border-t border-[var(--color-border)] flex flex-col gap-3">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-brand-700"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-brand-700"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm font-medium bg-brand-700 text-white px-4 py-2 rounded-full text-center transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Get started
                </Link>
              </>
            )}
          </li>
        </ul>
      </div>
    </header>
  )
}
