import Link from 'next/link'
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact'

const footerLinks = {
  Platform: [
    { href: '/vendors', label: 'Find Vendors' },
    { href: '/sign-up', label: 'Start Planning' },
    { href: '/#how-it-works', label: 'How It Works' },
  ],
  Vendors: [
    { href: '/vendor/sign-up', label: 'Join as a Vendor' },
    { href: '/', label: 'Vendor Dashboard' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: CONTACT_MAILTO, label: 'Contact' },
    { href: '/blog', label: 'Blog' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms of Service' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-brand-900 text-brand-200" aria-label="Site footer">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="font-display mb-4 flex items-center gap-2 text-xl font-semibold text-white"
              aria-label="Djanora — home"
            >
              <span className="bg-gold-600 text-brand-900 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                D
              </span>
              <span>Djanora</span>
            </Link>
            <p className="text-brand-300 text-sm leading-relaxed">
              Plan your event with confidence.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-brand-400 mb-4 text-xs font-semibold tracking-widest uppercase">
                {category}
              </h3>
              <ul className="flex flex-col gap-2" role="list">
                {links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-brand-300 text-sm transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-brand-300 text-sm transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-brand-800 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-brand-400 text-xs">
            &copy; {new Date().getFullYear()} Djanora. Ottawa, Ontario, Canada.
          </p>
          <p className="text-brand-500 text-xs">
            Questions?{' '}
            <a
              href={CONTACT_MAILTO}
              className="hover:text-brand-300 underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
