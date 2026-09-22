import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { UserRole, type Prisma } from '@prisma/client'
import { reviewFlags } from '../vendors/vendor-listing'
import { VENDOR_REVIEW_STATUS, type VendorReviewStatus } from '../vendors/vendor-review'
import { AdminRepository } from './admin.repository'

@Injectable()
export class AdminService {
  constructor(private repo: AdminRepository) {}

  async listVendors(clerkId: string, status?: string, q?: string) {
    await this.requireAdmin(clerkId)
    const reviewStatus = parseStatus(status)
    const query = q?.trim()
    const where: Prisma.VendorProfileWhereInput = {
      ...(reviewStatus ? { reviewStatus } : {}),
      ...(query
        ? {
            OR: [
              { businessName: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
              { user: { email: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }
    const [items, counts] = await Promise.all([
      this.repo.listVendors(where),
      this.repo.countVendorsByStatus(),
    ])
    return { items, counts }
  }

  async getVendor(clerkId: string, id: string) {
    await this.requireAdmin(clerkId)
    const vendor = await this.repo.findVendor(id)
    if (!vendor) throw new NotFoundException('Vendor not found')
    return vendor
  }

  async approveVendor(clerkId: string, id: string) {
    const admin = await this.requireAdmin(clerkId)
    return this.setStatus(id, VENDOR_REVIEW_STATUS.APPROVED, null, admin.id)
  }

  async rejectVendor(clerkId: string, id: string, reason: string) {
    const admin = await this.requireAdmin(clerkId)
    return this.setStatus(id, VENDOR_REVIEW_STATUS.REJECTED, reason, admin.id)
  }

  async suspendVendor(clerkId: string, id: string, reason: string) {
    const admin = await this.requireAdmin(clerkId)
    return this.setStatus(id, VENDOR_REVIEW_STATUS.SUSPENDED, reason, admin.id)
  }

  async restoreVendor(clerkId: string, id: string) {
    const admin = await this.requireAdmin(clerkId)
    const vendor = await this.repo.findVendorForRestore(id)
    if (!vendor) throw new NotFoundException('Vendor not found')
    if (vendor.user.deletedAt) {
      throw new BadRequestException('Cannot restore a listing whose owner was deleted')
    }
    if (vendor.reviewStatus !== VENDOR_REVIEW_STATUS.SUSPENDED) {
      throw new BadRequestException('Only a suspended vendor can be restored')
    }
    return this.setStatus(id, VENDOR_REVIEW_STATUS.APPROVED, null, admin.id)
  }

  async listUsers(clerkId: string, q?: string, role?: string) {
    await this.requireAdmin(clerkId)
    const query = q?.trim()
    const parsedRole = parseRole(role)
    return this.repo.listUsers({
      deletedAt: null,
      ...(parsedRole ? { role: parsedRole } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    })
  }

  async setUserRole(clerkId: string, userId: string, role: UserRole) {
    await this.requireAdmin(clerkId)
    const target = await this.repo.findUserForRole(userId)
    if (!target || target.deletedAt) throw new NotFoundException('User not found')
    if (target.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const admins = await this.repo.countActiveAdmins()
      if (admins <= 1) throw new BadRequestException('Cannot remove the last admin')
    }
    return this.repo.updateUserRole(userId, role)
  }

  private async requireAdmin(clerkId: string) {
    const user = await this.repo.findActiveByClerkId(clerkId)
    if (user?.role !== UserRole.ADMIN) throw new NotFoundException('Not found')
    return user
  }

  private async setStatus(
    id: string,
    status: VendorReviewStatus,
    note: string | null,
    reviewerId: string,
  ) {
    const vendor = await this.repo.findVendorStatus(id)
    if (!vendor) throw new NotFoundException('Vendor not found')
    return this.repo.updateVendorReview(id, {
      ...reviewFlags(status),
      reviewNote: note,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    })
  }
}

function parseStatus(value?: string): VendorReviewStatus | undefined {
  if (!value) return undefined
  return Object.values(VENDOR_REVIEW_STATUS).find((item) => item === value)
}

function parseRole(value?: string): UserRole | undefined {
  if (!value) return undefined
  return Object.values(UserRole).find((item) => item === value)
}
