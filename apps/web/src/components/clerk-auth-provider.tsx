'use client'

import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { CLERK_APPEARANCE } from '@/lib/clerk-appearance'
import { useTheme } from '@/components/theme-provider'

export function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()

  return (
    <ClerkProvider appearance={CLERK_APPEARANCE[resolvedTheme]} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  )
}
