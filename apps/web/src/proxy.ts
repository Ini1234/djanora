import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isSessionCookieName, mintFromSessionJwt } from '@/lib/clerk-token'

// '/' is public — the root page itself handles the landing vs signed-in home split
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/about(.*)',
  '/contact(.*)',
  '/blog(.*)',
  '/api/webhooks(.*)',
  '/api/auth/sign-out',
  '/api/proxy(.*)',
  '/api/sse(.*)',
  '/rsvp(.*)',
  '/events/join(.*)',
  '/vendors/:slug',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    // Clerk JWTs last 60s. Client navigations are RSC fetches, so Clerk's
    // handshake does not run and auth() looks signed-out even though the
    // session is still valid. Mint a fresh JWT and continue instead of
    // bouncing to /sign-in.
    const sessionCookie = request.cookies.getAll().find((c) => isSessionCookieName(c.name))
    const minted = sessionCookie?.value ? await mintFromSessionJwt(sessionCookie.value) : null
    if (minted && sessionCookie) {
      const res = NextResponse.next()
      // JWT exp is ~60s. Cookie must last for Clerk's session (~7 days),
      // not the token, or the browser drops __session while the user is
      // still signed in.
      res.cookies.set(sessionCookie.name, minted, {
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      })
      return res
    }
    return (await auth()).redirectToSignIn()
  }

  const roles = (sessionClaims?.metadata as { roles?: string[] })?.roles ?? []

  if (isAdminRoute(request) && !roles.includes('admin')) {
    return Response.redirect(new URL('/', request.url))
  }

  // Vendor and user route access is enforced at the page level using
  // our database (hasVendorProfile / activeMode), not Clerk session claims.
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
