'use client'

import { UserProfile } from '@clerk/nextjs'
import { CLERK_APPEARANCE } from '@/lib/clerk-appearance'
import { useTheme } from '@/components/theme-provider'

export function SettingsSecurity() {
  const { resolvedTheme } = useTheme()
  const appearance = CLERK_APPEARANCE[resolvedTheme]

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <UserProfile
        routing="hash"
        appearance={{
          ...appearance,
          elements: {
            ...appearance.elements,
            rootBox: { width: '100%', colorScheme: resolvedTheme },
            cardBox: { boxShadow: 'none', width: '100%' },
            card: {
              ...appearance.elements.card,
              boxShadow: 'none',
              border: 'none',
              width: '100%',
            },
          },
        }}
      />
    </div>
  )
}
