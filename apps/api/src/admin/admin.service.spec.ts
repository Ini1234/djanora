import { BadRequestException, NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { VENDOR_REVIEW_STATUS } from '../vendors/vendor-review'
import { AdminService } from './admin.service'

function adminRepo(overrides: Record<string, unknown> = {}) {
  return {
    findActiveByClerkId: jest
      .fn()
      .mockResolvedValue({ id: 'admin_1', role: UserRole.ADMIN, email: 'a@djanora.com' }),
    listVendors: jest.fn().mockResolvedValue([]),
    countVendorsByStatus: jest.fn().mockResolvedValue({
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
    }),
    findVendor: jest.fn(),
    findVendorStatus: jest.fn(),
    updateVendorReview: jest.fn(),
    listUsers: jest.fn(),
    findUserForRole: jest.fn(),
    countActiveAdmins: jest.fn().mockResolvedValue(2),
    updateUserRole: jest.fn(),
    ...overrides,
  }
}

describe('AdminService', () => {
  it('hides the admin API from non-admins', async () => {
    const repo = adminRepo({
      findActiveByClerkId: jest.fn().mockResolvedValue({ id: 'u1', role: UserRole.VENDOR }),
    })
    const svc = new AdminService(repo as never)
    await expect(svc.listVendors('clerk_1')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('hides the admin API from a deleted admin', async () => {
    const repo = adminRepo({
      findActiveByClerkId: jest.fn().mockResolvedValue(null),
    })
    const svc = new AdminService(repo as never)
    await expect(svc.listVendors('clerk_deleted')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('approves a vendor and marks them listed', async () => {
    const updateVendorReview = jest.fn().mockResolvedValue({
      id: 'v1',
      reviewStatus: VENDOR_REVIEW_STATUS.APPROVED,
      isVerified: true,
    })
    const repo = adminRepo({
      findVendorStatus: jest.fn().mockResolvedValue({ id: 'v1' }),
      updateVendorReview,
    })
    const svc = new AdminService(repo as never)
    await svc.approveVendor('clerk_admin', 'v1')
    expect(updateVendorReview).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        reviewStatus: VENDOR_REVIEW_STATUS.APPROVED,
        isVerified: true,
        isActive: true,
        reviewNote: null,
      }),
    )
  })

  it('rejects with a stored reason', async () => {
    const updateVendorReview = jest.fn().mockResolvedValue({ id: 'v1' })
    const repo = adminRepo({
      findVendorStatus: jest.fn().mockResolvedValue({ id: 'v1' }),
      updateVendorReview,
    })
    const svc = new AdminService(repo as never)
    await svc.rejectVendor('clerk_admin', 'v1', 'Social links do not match the business')
    expect(updateVendorReview).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({
        reviewStatus: VENDOR_REVIEW_STATUS.REJECTED,
        isVerified: false,
        isActive: false,
        reviewNote: 'Social links do not match the business',
      }),
    )
  })

  it('restores only suspended vendors', async () => {
    const repo = adminRepo({
      findVendorForRestore: jest.fn().mockResolvedValue({
        reviewStatus: VENDOR_REVIEW_STATUS.PENDING,
        user: { deletedAt: null },
      }),
    })
    const svc = new AdminService(repo as never)
    await expect(svc.restoreVendor('clerk_admin', 'v1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('does not restore a listing whose owner was deleted', async () => {
    const repo = adminRepo({
      findVendorForRestore: jest.fn().mockResolvedValue({
        reviewStatus: VENDOR_REVIEW_STATUS.SUSPENDED,
        user: { deletedAt: new Date() },
      }),
    })
    const svc = new AdminService(repo as never)
    await expect(svc.restoreVendor('clerk_admin', 'v1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('refuses to demote the last admin', async () => {
    const repo = adminRepo({
      findUserForRole: jest
        .fn()
        .mockResolvedValue({ id: 'admin_1', role: UserRole.ADMIN, deletedAt: null }),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
    })
    const svc = new AdminService(repo as never)
    await expect(svc.setUserRole('clerk_admin', 'admin_1', UserRole.USER)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
