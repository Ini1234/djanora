import type { MetadataRoute } from 'next'
import { publicGet } from '@/lib/backend'
import { SITE_URL, requestIsSandbox } from '@/lib/seo'

const STATIC_PATHS = ['/', '/about', '/contact', '/for-vendors', '/privacy', '/terms'] as const

type ListedVendor = { slug?: string }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (await requestIsSandbox()) return []

  const corePages = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === '/' ? '/' : path}`,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  })) satisfies MetadataRoute.Sitemap

  const vendors = await publicGet<ListedVendor[]>('/vendors')
  const vendorEntries = (Array.isArray(vendors) ? vendors : [])
    .map((vendor) => vendor.slug?.trim())
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({
      url: `${SITE_URL}/vendors/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  return [...corePages, ...vendorEntries]
}
