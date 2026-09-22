import { Injectable } from '@nestjs/common'
import { UserRole, type Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { VendorReviewStatus } from '../vendors/vendor-review'
import { liveUserWhere } from '../common/active-user'

export const VENDOR_LIST_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  category: true,
  categories: true,
  city: true,
  reviewStatus: true,
  reviewNote: true,
  reviewedAt: true,
  isVerified: true,
  isActive: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      city: true,
      deletedAt: true,
    },
  },
} as const

const USER_LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  hasVendorProfile: true,
  createdAt: true,
} as const

@Injectable()
export class AdminRepository {
  constructor(private prisma: PrismaService) {}

  findActiveByClerkId(clerkId: string) {
    return this.prisma.user.findFirst({
      where: liveUserWhere(clerkId),
      select: { id: true, role: true, email: true },
    })
  }

  listVendors(where: Prisma.VendorProfileWhereInput) {
    return this.prisma.vendorProfile.findMany({
      where,
      select: VENDOR_LIST_SELECT as never,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    })
  }

  async countVendorsByStatus() {
    const grouped = await this.prisma.vendorProfile.groupBy({
      by: ['reviewStatus'] as never,
      _count: { _all: true },
    } as never)
    const counts = { pending: 0, approved: 0, rejected: 0, suspended: 0 }
    for (const row of grouped as Array<{
      reviewStatus?: string
      _count?: { _all?: number }
    }>) {
      const n = row._count?._all ?? 0
      if (row.reviewStatus === 'PENDING') counts.pending = n
      if (row.reviewStatus === 'APPROVED') counts.approved = n
      if (row.reviewStatus === 'REJECTED') counts.rejected = n
      if (row.reviewStatus === 'SUSPENDED') counts.suspended = n
    }
    return counts
  }

  findVendor(id: string) {
    return this.prisma.vendorProfile.findUnique({
      where: { id },
      select: {
        ...VENDOR_LIST_SELECT,
        bio: true,
        tribesServed: true,
        estimatedPriceFrom: true,
        estimatedPriceTo: true,
        currency: true,
        websiteUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        externalPortfolioUrl: true,
        reviewedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      } as never,
    })
  }

  findVendorForRestore(id: string) {
    return this.prisma.vendorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        reviewStatus: true,
        user: { select: { deletedAt: true } },
      } as never,
    }) as Promise<{
      id: string
      reviewStatus: string
      user: { deletedAt: Date | null }
    } | null>
  }

  async findVendorStatus(id: string) {
    const vendor = (await this.prisma.vendorProfile.findUnique({
      where: { id },
      select: { id: true, reviewStatus: true } as never,
    })) as { id: string; reviewStatus?: string } | null
    if (!vendor) return null
    return {
      id: vendor.id,
      reviewStatus: String(vendor.reviewStatus ?? ''),
    }
  }

  updateVendorReview(
    id: string,
    data: {
      reviewStatus: VendorReviewStatus
      isVerified: boolean
      isActive: boolean
      reviewNote: string | null
      reviewedAt: Date
      reviewedById: string
    },
  ) {
    return this.prisma.vendorProfile.update({
      where: { id },
      data: data as never,
      select: VENDOR_LIST_SELECT as never,
    })
  }

  listUsers(where: Prisma.UserWhereInput) {
    return this.prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  findUserForRole(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, deletedAt: true },
    })
  }

  countActiveAdmins() {
    return this.prisma.user.count({
      where: { role: UserRole.ADMIN, deletedAt: null },
    })
  }

  updateUserRole(id: string, role: UserRole) {
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: USER_LIST_SELECT,
    })
  }
}
