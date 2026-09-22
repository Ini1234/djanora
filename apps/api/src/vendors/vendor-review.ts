export const VENDOR_REVIEW_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const

export type VendorReviewStatus = (typeof VENDOR_REVIEW_STATUS)[keyof typeof VENDOR_REVIEW_STATUS]
