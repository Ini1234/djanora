'use client'

import { ClerkProvider, UserProfile } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

export function SettingsSecurity() {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <div className="overflow-hidden rounded-xl bg-white">
        <UserProfile
          routing="hash"
          appearance={{
            ...clerkAppearance,
            elements: {
              ...clerkAppearance.elements,
              rootBox: { width: '100%' },
              cardBox: { boxShadow: 'none', width: '100%' },
              card: {
                ...clerkAppearance.elements.card,
                boxShadow: 'none',
                border: 'none',
                width: '100%',
              },
            },
          }}
        />
      </div>
    </ClerkProvider>
  )
}
