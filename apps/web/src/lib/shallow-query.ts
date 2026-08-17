/**
 * Update query params without a Next.js navigation.
 *
 * App Router has no shallow routing. `router.replace()` is a real navigation:
 * Server Components re-run (layout `getMe()` → `/users/me`) and client pages
 * can remount. The History API does not.
 *
 * @see https://nextjs.org/docs/app/getting-started/linking-and-navigating#using-the-native-history-api
 */
export function replaceShallowQuery(
  pathname: string,
  patch: Record<string, string | null>,
): void {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(patch)) {
    if (!value || value === 'all' || value === 'ALL') params.delete(key)
    else params.set(key, value)
  }
  const qs = params.toString()
  const url = qs ? `${pathname}?${qs}` : pathname
  const current = `${window.location.pathname}${window.location.search}`
  if (url === current) return
  window.history.replaceState(window.history.state, '', url)
}
