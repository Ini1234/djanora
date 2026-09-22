import type { MetadataRoute } from 'next'
import { SITE_URL, requestIsSandbox } from '@/lib/seo'

/**
 * Production robots only. The testing sandbox (test.djanora.com) disallows all
 * crawlers so it is never submitted to Google Search Console or Bing.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await requestIsSandbox()) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/about',
          '/contact',
          '/for-vendors',
          '/privacy',
          '/terms',
          '/vendors/',
          '/e/',
          '/llms.txt',
        ],
        disallow: [
          '/api/',
          '/rsvp/',
          '/events/join/',
          '/sign-in',
          '/sign-up',
          '/onboarding',
          '/dashboard',
          '/events',
          '/settings',
          '/messages',
          '/inquiries',
          '/admin',
          '/vendor',
          '/inspiration',
          '/likes',
          '/portfolio',
          '/assistant',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
