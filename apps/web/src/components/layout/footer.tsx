import Link from 'next/link'
import { CONTACT_EMAIL, CONTACT_PATH } from '@/lib/contact'

const footerLinks = {
  Platform: [
    { href: '/#how-it-works', label: 'How it works' },
    { href: '/sign-up', label: 'Start planning' },
    { href: '/for-vendors', label: 'For vendors' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: CONTACT_PATH, label: 'Contact' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
}

export function Footer() {
  return (
    <footer className="panel-inverse" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="font-display mb-4 flex items-center gap-2 text-xl font-semibold"
              aria-label="Djanora — home"
            >
              <span className="bg-inverse-foreground text-inverse flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                D
              </span>
              <span>Djanora</span>
            </Link>
            <p className="text-inverse-muted text-sm leading-relaxed">
              Event planning software for hosts and vendors. Ottawa, Ontario.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-inverse-muted mb-4 text-xs font-semibold tracking-widest uppercase">
                {category}
              </h3>
              <ul className="flex flex-col gap-2" role="list">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-inverse-muted hover:text-inverse-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-inverse-muted text-xs">
            &copy; {new Date().getFullYear()} Djanora. Ottawa, Ontario, Canada.
          </p>
          <p className="text-inverse-muted text-xs">
            Questions?{' '}
            <Link
              href={CONTACT_PATH}
              className="hover:text-inverse-foreground underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
