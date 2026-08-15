import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export type Locale = 'en' | 'fr'
export const locales: Locale[] = ['en', 'fr']
export const defaultLocale: Locale = 'en'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const raw = cookieStore.get('locale')?.value
  const locale: Locale = locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
