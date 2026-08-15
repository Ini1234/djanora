import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'
import { safeInternalPath } from '@/lib/safe-path'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your free Djanora account and start planning your event.',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ redirect_url?: string }>
}

export default async function SignUpPage({ searchParams }: Props) {
  const { redirect_url: raw } = await searchParams
  const redirectUrl = safeInternalPath(raw)
  const signInUrl = redirectUrl
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-in'

  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl={signInUrl}
      forceRedirectUrl={redirectUrl ?? undefined}
      fallbackRedirectUrl={redirectUrl ?? '/onboarding'}
    />
  )
}
