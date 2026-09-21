import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="panel-inverse relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pattern-adire absolute inset-0 opacity-10" aria-hidden="true" />

        <div className="relative">
          <Link
            href="/"
            className="font-display flex items-center gap-2 text-xl font-semibold"
            style={{ color: 'var(--inverse-foreground)' }}
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
            <p
              className="font-display text-3xl leading-snug font-semibold"
              style={{ color: 'var(--inverse-foreground)' }}
            >
              &ldquo;Your event. Your plan. Your way.&rdquo;
            </p>
          </blockquote>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--inverse-foreground)' }}>
              Djanora
            </p>
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
              <p className="text-lg font-semibold" style={{ color: 'var(--inverse-foreground)' }}>
                {item.value}
              </p>
              <p className="text-inverse-muted text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-col items-center justify-center bg-[var(--color-background)] px-4 py-12"
      >
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
      </main>
    </div>
  )
}
