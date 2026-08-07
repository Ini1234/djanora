import Link from 'next/link'

const footerLinks = {
  Platform: [
    { href: '/vendors', label: 'Find Vendors' },
    { href: '/sign-up', label: 'Start Planning' },
    { href: '/#how-it-works', label: 'How It Works' },
  ],
  Vendors: [
    { href: '/vendor/sign-up', label: 'Join as a Vendor' },
    { href: '/vendor/dashboard', label: 'Vendor Dashboard' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-semibold text-white mb-4"
              aria-label="CaaS — home"
            >
              <span className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-brand-900 text-sm font-bold">
                C
              </span>
              <span>CaaS</span>
            </Link>
            <p className="text-sm text-brand-300 leading-relaxed">
              Culture as a Service. Plan your Nigerian wedding in Ottawa with confidence.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-4">
                {category}
              </h3>
              <ul className="flex flex-col gap-2" role="list">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-brand-300 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-brand-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-400">
            &copy; {new Date().getFullYear()} CaaS. Ottawa, Ontario, Canada.
          </p>
          <p className="text-xs text-brand-500">Built for the diaspora, by the diaspora.</p>
        </div>
      </div>
    </footer>
  )
}
