import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/vendors(.*)',
  '/api/webhooks(.*)',
])

const isVendorRoute = createRouteMatcher(['/vendor(.*)'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return (await auth()).redirectToSignIn()
  }

  const roles = (sessionClaims?.metadata as { roles?: string[] })?.roles ?? []

  if (isAdminRoute(request) && !roles.includes('admin')) {
    const url = new URL('/dashboard', request.url)
    return Response.redirect(url)
  }

  if (isVendorRoute(request) && !roles.includes('vendor')) {
    const url = new URL('/dashboard', request.url)
    return Response.redirect(url)
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
