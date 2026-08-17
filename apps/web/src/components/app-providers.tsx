'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SseProvider } from '@/contexts/sse-context'

export function AppProviders({
  children,
  signedIn,
}: {
  children: ReactNode
  signedIn: boolean
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SseProvider enabled={signedIn}>{children}</SseProvider>
    </QueryClientProvider>
  )
}
