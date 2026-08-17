import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { InspirationVisibility } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto'
import { CreateReviewDto } from './dto/create-review.dto'
import { POST_INCLUDE, mapPost } from '../inspiration/post-shape'
import { attachLookStats } from '../inspiration/look-stats'
import type { UpdateVendorMeDto } from './dto/vendor-post.dto'

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(category?: string) {
    const vendors = await this.prisma.vendorProfile.findMany({
      where: {
        isActive: true,
        ...(category
          ? {
              OR: [{ category: category as any }, { categories: { has: category as any } }],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        businessName: true,
        category: true,
        isVerified: true,
        averageRating: true,
        totalReviews: true,
        estimatedPriceFrom: true,
        estimatedPriceTo: true,
        currency: true,
        user: {
          select: {
            city: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ isVerified: 'desc' }, { averageRating: 'desc' }, { businessName: 'asc' }],
      take: 100,
    })

    return vendors.map((v) => ({
      id: v.id,
      slug: v.slug,
      businessName: v.businessName,
      category: v.category,
      isVerified: v.isVerified,
      averageRating: v.averageRating,
      totalReviews: v.totalReviews,
      estimatedPriceFrom: v.estimatedPriceFrom,
      estimatedPriceTo: v.estimatedPriceTo,
      currency: v.currency,
      city: v.user?.city ?? null,
      avatarUrl: v.user?.avatarUrl ?? null,
    }))
  }

  /**
   * Called at the end of vendor onboarding.
   * Creates a VendorProfile and marks the user as having a profile.
   */
  async createProfile(clerkId: string, dto: CreateVendorProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: true },
    })

    if (!user) throw new NotFoundException('User not found')
    if (user.vendorProfile) throw new ConflictException('Vendor profile already exists')

    // Generate a unique slug from business name
    const base = dto.businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60)

    let slug = base
    let suffix = 0
    while (await this.prisma.vendorProfile.findUnique({ where: { slug } })) {
      suffix++
      slug = `${base}-${suffix}`
    }

    const allCategories =
      dto.categories && dto.categories.length > 0 ? dto.categories : [dto.category]

    const profile = await this.prisma.vendorProfile.create({
      data: {
        userId: user.id,
        slug,
        businessName: dto.businessName,
        category: allCategories[0] as any,
        categories: allCategories as any,
        bio: dto.bio ?? null,
        tribesServed: (dto.tribesServed ?? []) as any,
        estimatedPriceFrom: dto.estimatedPriceFrom ?? null,
        estimatedPriceTo: dto.estimatedPriceTo ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        instagramUrl: dto.instagramUrl ?? null,
        facebookUrl: dto.facebookUrl ?? null,
      },
    })

    // Update user's city (collected during vendor onboarding) + flag
    await this.prisma.user.update({
      where: { clerkId },
      data: {
        hasVendorProfile: true,
        activeMode: 'vendor',
        ...(dto.city ? { city: dto.city } : {}),
      },
    })

    return profile
  }

  /** Returns a single public vendor profile by slug. */
  async findBySlug(slug: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        slug: true,
        businessName: true,
        category: true,
        categories: true,
        bio: true,
        tribesServed: true,
        isVerified: true,
        averageRating: true,
        totalReviews: true,
        estimatedPriceFrom: true,
        estimatedPriceTo: true,
        currency: true,
        websiteUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        externalPortfolioUrl: true,
        externalPortfolioLabel: true,
        createdAt: true,
        reviews: {
          orderBy: { createdAt: 'desc' as const },
          take: 20,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
        inspirationItems: {
          where: {
            visibility: { in: [InspirationVisibility.PROFILE, InspirationVisibility.INSPIRATION] },
          },
          orderBy: { createdAt: 'desc' as const },
          include: POST_INCLUDE,
        },
        user: {
          select: { city: true, avatarUrl: true, firstName: true, lastName: true },
        },
        _count: { select: { favorites: true } },
      },
    })

    if (!vendor) throw new NotFoundException('Vendor not found')

    const posts = await attachLookStats(this.prisma, vendor.inspirationItems.map(mapPost))

    return {
      id: vendor.id,
      slug: vendor.slug,
      businessName: vendor.businessName,
      category: vendor.category,
      categories: vendor.categories,
      bio: vendor.bio,
      tribesServed: vendor.tribesServed,
      isVerified: vendor.isVerified,
      averageRating: vendor.averageRating,
      totalReviews: vendor.totalReviews,
      estimatedPriceFrom: vendor.estimatedPriceFrom,
      estimatedPriceTo: vendor.estimatedPriceTo,
      currency: vendor.currency,
      websiteUrl: vendor.websiteUrl,
      instagramUrl: vendor.instagramUrl,
      facebookUrl: vendor.facebookUrl,
      externalPortfolioUrl: vendor.externalPortfolioUrl,
      externalPortfolioLabel: vendor.externalPortfolioLabel,
      city: vendor.user?.city ?? null,
      avatarUrl: vendor.user?.avatarUrl ?? null,
      ownerName: [vendor.user?.firstName, vendor.user?.lastName].filter(Boolean).join(' ') || null,
      reviews: vendor.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        authorName: [r.author.firstName, r.author.lastName].filter(Boolean).join(' ') || 'Guest',
      })),
      posts,
      favoriteCount: vendor._count.favorites,
    }
  }

  async reviewStatus(clerkId: string, slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return { canReview: false, alreadyReviewed: false }

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: { id: true, userId: true },
    })
    if (!vendor || vendor.userId === user.id) {
      return { canReview: false, alreadyReviewed: false }
    }

    const existing = await this.prisma.review.findUnique({
      where: {
        authorId_vendorProfileId: { authorId: user.id, vendorProfileId: vendor.id },
      },
      select: { id: true },
    })
    if (existing) return { canReview: false, alreadyReviewed: true }

    const booked = await this.prisma.inquiry.findFirst({
      where: { senderId: user.id, vendorProfileId: vendor.id, status: 'BOOKED' },
      select: { id: true },
    })
    return { canReview: Boolean(booked), alreadyReviewed: false }
  }

  async recordView(slug: string, clerkId?: string) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: { id: true, userId: true },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    if (clerkId) {
      const viewer = await this.prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
      if (viewer?.id === vendor.userId) return { counted: false }
    }
    await this.prisma.vendorProfile.update({
      where: { id: vendor.id },
      data: { profileViews: { increment: 1 } },
    })
    return { counted: true }
  }

  async createReview(clerkId: string, slug: string, dto: CreateReviewDto) {
    const user = await this.prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
    if (!user) throw new NotFoundException('User not found')

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: { id: true, userId: true },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    if (vendor.userId === user.id)
      throw new BadRequestException('You cannot review your own listing')

    const booked = await this.prisma.inquiry.findFirst({
      where: { senderId: user.id, vendorProfileId: vendor.id, status: 'BOOKED' },
      select: { id: true },
    })
    if (!booked)
      throw new ForbiddenException('You can review a vendor after marking them as booked')

    try {
      const review = await this.prisma.review.create({
        data: {
          authorId: user.id,
          vendorProfileId: vendor.id,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
        },
      })
      const agg = await this.prisma.review.aggregate({
        where: { vendorProfileId: vendor.id },
        _avg: { rating: true },
        _count: true,
      })
      await this.prisma.vendorProfile.update({
        where: { id: vendor.id },
        data: {
          averageRating: agg._avg.rating,
          totalReviews: agg._count,
        },
      })
      return review
    } catch {
      throw new ConflictException('You have already reviewed this vendor')
    }
  }

  /** Returns the current vendor's own profile (for the vendor dashboard). */
  async getMyProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: {
        vendorProfile: {
          select: {
            id: true,
            slug: true,
            businessName: true,
            category: true,
            categories: true,
            bio: true,
            tribesServed: true,
            estimatedPriceFrom: true,
            estimatedPriceTo: true,
            currency: true,
            websiteUrl: true,
            instagramUrl: true,
            facebookUrl: true,
            externalPortfolioUrl: true,
            externalPortfolioLabel: true,
            isVerified: true,
            isActive: true,
            averageRating: true,
            totalReviews: true,
            profileViews: true,
            createdAt: true,
            _count: {
              select: { inquiries: true, reviews: true, budgetBookings: true },
            },
          },
        },
      },
    })

    if (!user) throw new NotFoundException('User not found')
    if (!user.vendorProfile) throw new NotFoundException('No vendor profile found')

    const p = user.vendorProfile
    const portfolioCount = await this.prisma.inspirationItem.count({
      where: {
        vendorProfileId: p.id,
        visibility: { in: [InspirationVisibility.PROFILE, InspirationVisibility.INSPIRATION] },
        media: { some: {} },
      },
    })
    return {
      id: p.id,
      slug: p.slug,
      businessName: p.businessName,
      category: p.category,
      categories: p.categories,
      bio: p.bio,
      tribesServed: p.tribesServed,
      estimatedPriceFrom: p.estimatedPriceFrom,
      estimatedPriceTo: p.estimatedPriceTo,
      currency: p.currency,
      websiteUrl: p.websiteUrl,
      instagramUrl: p.instagramUrl,
      facebookUrl: p.facebookUrl,
      externalPortfolioUrl: p.externalPortfolioUrl,
      externalPortfolioLabel: p.externalPortfolioLabel,
      isVerified: p.isVerified,
      isActive: p.isActive,
      averageRating: p.averageRating,
      totalReviews: p.totalReviews,
      profileViews: p.profileViews,
      createdAt: p.createdAt,
      city: user.city,
      inquiryCount: p._count.inquiries,
      portfolioCount,
      reviewCount: p._count.reviews,
      bookingCount: p._count.budgetBookings,
    }
  }

  async updateMe(clerkId: string, dto: UpdateVendorMeDto) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { vendorProfile: { select: { id: true } } },
    })
    if (!user?.vendorProfile) throw new NotFoundException('No vendor profile found')
    return this.prisma.vendorProfile.update({
      where: { id: user.vendorProfile.id },
      data: {
        ...(dto.externalPortfolioUrl !== undefined && {
          externalPortfolioUrl: dto.externalPortfolioUrl?.trim() || null,
        }),
        ...(dto.externalPortfolioLabel !== undefined && {
          externalPortfolioLabel: dto.externalPortfolioLabel?.trim() || null,
        }),
      },
      select: {
        id: true,
        externalPortfolioUrl: true,
        externalPortfolioLabel: true,
      },
    })
  }

  private async requireUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async favorite(clerkId: string, slug: string) {
    const user = await this.requireUser(clerkId)
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: { id: true, userId: true },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    if (vendor.userId === user.id) {
      throw new BadRequestException('You cannot favorite your own profile')
    }

    await this.prisma.vendorFavorite.upsert({
      where: {
        userId_vendorProfileId: { userId: user.id, vendorProfileId: vendor.id },
      },
      create: { userId: user.id, vendorProfileId: vendor.id },
      update: {},
    })

    const favoriteCount = await this.prisma.vendorFavorite.count({
      where: { vendorProfileId: vendor.id },
    })
    return { favorited: true, favoriteCount }
  }

  async unfavorite(clerkId: string, slug: string) {
    const user = await this.requireUser(clerkId)
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')

    await this.prisma.vendorFavorite.deleteMany({
      where: { userId: user.id, vendorProfileId: vendor.id },
    })

    const favoriteCount = await this.prisma.vendorFavorite.count({
      where: { vendorProfileId: vendor.id },
    })
    return { favorited: false, favoriteCount }
  }

  async favoriteStatus(clerkId: string, slug: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { slug, isActive: true },
      select: { id: true, userId: true, _count: { select: { favorites: true } } },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    if (!user)
      return { favorited: false, favoriteCount: vendor._count.favorites, ownProfile: false }
    if (vendor.userId === user.id) {
      return { favorited: false, favoriteCount: vendor._count.favorites, ownProfile: true }
    }

    const row = await this.prisma.vendorFavorite.findUnique({
      where: {
        userId_vendorProfileId: { userId: user.id, vendorProfileId: vendor.id },
      },
      select: { userId: true },
    })
    return { favorited: Boolean(row), favoriteCount: vendor._count.favorites, ownProfile: false }
  }

  async getFavorites(clerkId: string) {
    const user = await this.requireUser(clerkId)
    const rows = await this.prisma.vendorFavorite.findMany({
      where: { userId: user.id, vendorProfile: { isActive: true } },
      orderBy: { createdAt: 'desc' },
      include: {
        vendorProfile: {
          select: {
            id: true,
            slug: true,
            businessName: true,
            category: true,
            isVerified: true,
            averageRating: true,
            totalReviews: true,
            estimatedPriceFrom: true,
            estimatedPriceTo: true,
            currency: true,
            user: { select: { city: true, avatarUrl: true } },
          },
        },
      },
    })

    return rows.map((row) => {
      const v = row.vendorProfile
      return {
        id: v.id,
        slug: v.slug,
        businessName: v.businessName,
        category: v.category,
        isVerified: v.isVerified,
        averageRating: v.averageRating,
        totalReviews: v.totalReviews,
        estimatedPriceFrom: v.estimatedPriceFrom,
        estimatedPriceTo: v.estimatedPriceTo,
        currency: v.currency,
        city: v.user?.city ?? null,
        avatarUrl: v.user?.avatarUrl ?? null,
      }
    })
  }
}
