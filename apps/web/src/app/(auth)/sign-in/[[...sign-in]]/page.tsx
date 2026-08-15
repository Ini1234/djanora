import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'
import { safeInternalPath } from '@/lib/safe-path'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Djanora account to continue planning your event.',
  robots: { index: false, follow: false },
}

interface Props {
  searchParams: Promise<{ redirect_url?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { redirect_url: raw } = await searchParams
  const redirectUrl = safeInternalPath(raw)
  const signUpUrl = redirectUrl
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : '/sign-up'

  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl={signUpUrl}
      forceRedirectUrl={redirectUrl ?? undefined}
      fallbackRedirectUrl={redirectUrl ?? '/'}
    />
  )
}
