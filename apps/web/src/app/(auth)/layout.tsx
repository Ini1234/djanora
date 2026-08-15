import Link from 'next/link'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-brand-900 p-12 relative overflow-hidden">
        {/* Dot pattern */}
        <div className="absolute inset-0 pattern-adire opacity-10" aria-hidden="true" />

        {/* Gold gradient blob */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-gold-600/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-brand-600/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-xl font-semibold text-white"
            aria-label="Djanora — go to homepage"
          >
            <span className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-brand-900 text-sm font-bold">
              D
            </span>
            <span>Djanora</span>
          </Link>
        </div>

        <div className="relative space-y-6">
          <blockquote>
            <p className="font-display text-3xl font-semibold text-white leading-snug">
              &ldquo;Your culture deserves to be celebrated — not guessed at.&rdquo;
            </p>
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold-600/30 flex items-center justify-center text-gold-300 text-lg">
              🎊
            </div>
            <div>
              <p className="text-sm font-medium text-white">Djanora</p>
              <p className="text-xs text-brand-300">Ottawa, Ontario — Nigerian weddings</p>
            </div>
          </div>
        </div>

        <div className="relative flex gap-8">
          {[
            { value: 'Yoruba', label: 'Tradition' },
            { value: 'Igbo', label: 'Heritage' },
            { value: 'Hausa', label: 'Culture' },
          ].map((item) => (
            <div key={item.value}>
              <p className="text-lg font-semibold text-white">{item.value}</p>
              <p className="text-xs text-brand-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-col items-center justify-center px-4 py-12 bg-[var(--color-background)]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-xl font-semibold text-brand-800"
            aria-label="Djanora — go to homepage"
          >
            <span className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-bold">
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
