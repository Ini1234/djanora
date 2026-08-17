import Link from 'next/link'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — brand panel */}
        <div className="bg-brand-900 relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          {/* Dot pattern */}
          <div className="pattern-adire absolute inset-0 opacity-10" aria-hidden="true" />

          {/* Gold gradient blob */}
          <div
            className="bg-gold-600/20 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl"
            aria-hidden="true"
          />
          <div
            className="bg-brand-600/30 absolute -bottom-32 -left-32 h-96 w-96 rounded-full blur-3xl"
            aria-hidden="true"
          />

          <div className="relative">
            <Link
              href="/"
              className="font-display flex items-center gap-2 text-xl font-semibold text-white"
              aria-label="Djanora — go to homepage"
            >
              <span className="bg-gold-600 text-brand-900 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                D
              </span>
              <span>Djanora</span>
            </Link>
          </div>

          <div className="relative space-y-6">
            <blockquote>
              <p className="font-display text-3xl leading-snug font-semibold text-white">
                &ldquo;Your event. Your plan. Your way.&rdquo;
              </p>
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="bg-gold-600/30 text-gold-300 flex h-10 w-10 items-center justify-center rounded-full text-lg">
                🎊
              </div>
              <div>
                <p className="text-sm font-medium text-white">Djanora</p>
                <p className="text-brand-300 text-xs">Ottawa, Ontario — event planning</p>
              </div>
            </div>
          </div>

          <div className="relative flex gap-8">
            {[
              { value: 'Budget', label: 'Stay on track' },
              { value: 'Vendors', label: 'Book in one place' },
              { value: 'Guests', label: 'Keep everyone in sync' },
            ].map((item) => (
              <div key={item.value}>
                <p className="text-lg font-semibold text-white">{item.value}</p>
                <p className="text-brand-400 text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — auth form */}
        <div className="flex flex-col items-center justify-center bg-[var(--color-background)] px-4 py-12">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="font-display text-brand-800 flex items-center gap-2 text-xl font-semibold"
              aria-label="Djanora — go to homepage"
            >
              <span className="bg-brand-700 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
                D
              </span>
              <span>Djanora</span>
            </Link>
          </div>

          {children}
        </div>
      </div>
    </ClerkProvider>
  )
}
