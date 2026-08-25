/** Persist next-intl locale and reload so the server re-reads the cookie. */
export function persistLocale(next: 'en' | 'fr') {
  document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`
  window.location.reload()
}
