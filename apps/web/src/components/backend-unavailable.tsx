'use client'

function Message() {
  return (
    <>
      <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Can&apos;t reach Djanora right now
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--color-muted)' }}>
        You&apos;re still signed in. The server took too long to answer. Try again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex min-h-11 items-center self-start text-sm font-medium"
        style={{ color: 'var(--color-brand-primary)' }}
      >
        Try again
      </button>
    </>
  )
}

export function BackendUnavailable({ asPage = false }: { asPage?: boolean }) {
  const body = (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-16">
      <Message />
    </div>
  )

  if (!asPage) return body

  return (
    <main id="main-content" tabIndex={-1}>
      {body}
    </main>
  )
}
