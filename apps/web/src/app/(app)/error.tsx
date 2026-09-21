'use client'

import { BackendUnavailable } from '@/components/backend-unavailable'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  if (error.name === 'BackendUnavailableError' || error.message === 'backend_unavailable') {
    return <BackendUnavailable />
  }

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
        Something went wrong
      </h1>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex min-h-11 items-center self-start text-sm font-medium"
        style={{ color: 'var(--color-brand-primary)' }}
      >
        Try again
      </button>
    </div>
  )
}
