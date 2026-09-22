import { listedVendorWhere, reviewFlags } from './vendor-listing'
import { VENDOR_REVIEW_STATUS } from './vendor-review'

describe('vendor listing', () => {
  it('lists only approved vendors', () => {
    expect(listedVendorWhere()).toEqual({
      reviewStatus: VENDOR_REVIEW_STATUS.APPROVED,
      user: { deletedAt: null },
    })
  })

  it('keeps pending vendors unlisted but able to edit', () => {
    expect(reviewFlags(VENDOR_REVIEW_STATUS.PENDING)).toEqual({
      reviewStatus: VENDOR_REVIEW_STATUS.PENDING,
      isVerified: false,
      isActive: true,
    })
    expect(reviewFlags(VENDOR_REVIEW_STATUS.REJECTED).isActive).toBe(false)
    expect(reviewFlags(VENDOR_REVIEW_STATUS.APPROVED).isVerified).toBe(true)
  })
})
