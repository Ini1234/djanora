import type { Prisma } from '@prisma/client'
import { VENDOR_REVIEW_STATUS, type VendorReviewStatus } from './vendor-review'

export function listedVendorWhere(): Prisma.VendorProfileWhereInput {
  return {
    reviewStatus: VENDOR_REVIEW_STATUS.APPROVED,
    user: { deletedAt: null },
  }
}

export function reviewFlags(status: VendorReviewStatus) {
  return {
    reviewStatus: status,
    isVerified: status === VENDOR_REVIEW_STATUS.APPROVED,
    isActive: status === VENDOR_REVIEW_STATUS.APPROVED || status === VENDOR_REVIEW_STATUS.PENDING,
  }
}
