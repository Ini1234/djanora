import { InspirationMediaType, InspirationVisibility } from '@prisma/client'

export const MEDIA_PER_POST = 10
export const POSTS_PER_VENDOR = 50
export const TAGS_PER_POST = 10

export const POST_INCLUDE = {
  media: { orderBy: { sortOrder: 'asc' as const } },
  tagLinks: {
    include: { tag: { select: { slug: true, label: true, isCurated: true } } },
  },
  vendorProfile: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      isVerified: true,
      avatarUrl: true,
      city: true,
    },
  },
} as const

export function slugifyTag(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function mapPost<
  T extends {
    id: string
    title: string
    description: string
    category: string
    tags: string[]
    imageUrl: string | null
    location: string | null
    priceRangeFrom: number | null
    priceRangeTo: number | null
    currency: string
    costNote?: string | null
    visibility: InspirationVisibility
    isAdminCurated: boolean
    createdAt: Date
    media: {
      id: string
      url: string
      mediaType: InspirationMediaType
      caption: string | null
      isCover: boolean
      sortOrder: number
    }[]
    tagLinks: { tag: { slug: string; label: string; isCurated: boolean } }[]
    vendorProfile: {
      id: string
      slug: string
      businessName: string
      isVerified: boolean
      avatarUrl: string | null
      city: string | null
    } | null
  },
>(row: T) {
  const tagItems = row.tagLinks.map((l) => l.tag)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    priceRangeFrom: row.priceRangeFrom,
    priceRangeTo: row.priceRangeTo,
    currency: row.currency,
    costNote: row.costNote ?? null,
    visibility: row.visibility,
    imageUrl: row.imageUrl,
    isAdminCurated: row.isAdminCurated,
    createdAt: row.createdAt,
    tags: tagItems.map((t) => t.label),
    tagItems,
    media: row.media,
    vendorProfile: row.vendorProfile,
  }
}
