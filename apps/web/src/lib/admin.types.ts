import type { VendorCategory, VendorReviewStatus } from './api.types'

export type AdminVendorRow = {
  id: string
  slug: string
  businessName: string
  category: VendorCategory
  categories: VendorCategory[]
  city: string | null
  reviewStatus: VendorReviewStatus
  reviewNote: string | null
  reviewedAt: string | null
  isVerified: boolean
  isActive: boolean
  createdAt: string
  bio?: string | null
  tribesServed?: string[]
  estimatedPriceFrom?: number | null
  estimatedPriceTo?: number | null
  currency?: string
  websiteUrl?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  externalPortfolioUrl?: string | null
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    city: string | null
  }
  reviewedBy?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
}

export type AdminVendorList = {
  items: AdminVendorRow[]
  counts: {
    pending: number
    approved: number
    rejected: number
    suspended: number
  }
}

export type AdminUserRow = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'USER' | 'VENDOR' | 'ADMIN'
  hasVendorProfile: boolean
  createdAt: string
}
