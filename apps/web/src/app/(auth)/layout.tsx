import Link from 'next/link'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left — brand panel */}
        <div className="panel-inverse relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="pattern-adire absolute inset-0 opacity-10" aria-hidden="true" />

          <div className="relative">
            <Link
              href="/"
              className="font-display flex items-center gap-2 text-xl font-semibold"
              aria-label="Djanora — go to homepage"
            >
              <span className="bg-primary-foreground text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                D
              </span>
              <span>Djanora</span>
            </Link>
          </div>

          <div className="relative space-y-6">
            <blockquote>
              <p className="font-display text-3xl leading-snug font-semibold">
                &ldquo;Your event. Your plan. Your way.&rdquo;
              </p>
            </blockquote>
            <div>
              <p className="text-sm font-medium">Djanora</p>
              <p className="text-inverse-muted text-xs">Ottawa, Ontario — event planning</p>
            </div>
          </div>

          <div className="relative flex gap-8">
            {[
              { value: 'Budget', label: 'Stay on track' },
              { value: 'Vendors', label: 'Book in one place' },
              { value: 'Guests', label: 'Keep everyone in sync' },
            ].map((item) => (
              <div key={item.value}>
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-inverse-muted text-xs">{item.label}</p>
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
              className="font-display text-foreground flex items-center gap-2 text-xl font-semibold"
              aria-label="Djanora — go to homepage"
            >
              <span className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
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
