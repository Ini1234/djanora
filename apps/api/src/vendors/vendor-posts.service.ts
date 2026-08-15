import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InspirationMediaType, InspirationVisibility, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  MEDIA_PER_POST,
  POSTS_PER_VENDOR,
  POST_INCLUDE,
  TAGS_PER_POST,
  mapPost,
  slugifyTag,
} from '../inspiration/post-shape'
import type { CreateVendorPostDto, UpdateVendorPostDto } from './dto/vendor-post.dto'

@Injectable()
export class VendorPostsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireProfile(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, vendorProfile: { select: { id: true } } },
    })
    if (!user?.vendorProfile) throw new NotFoundException('No vendor profile found')
    return { userId: user.id, vendorProfileId: user.vendorProfile.id }
  }

  private async requireOwnedPost(clerkId: string, postId: string) {
    const { vendorProfileId } = await this.requireProfile(clerkId)
    const post = await this.prisma.inspirationItem.findFirst({
      where: { id: postId, vendorProfileId },
      include: POST_INCLUDE,
    })
    if (!post) throw new NotFoundException('Post not found')
    return { vendorProfileId, post }
  }

  async syncTags(itemId: string, labels: string[]) {
    const unique: { slug: string; label: string }[] = []
    const seen = new Set<string>()
    for (const raw of labels) {
      const slug = slugifyTag(raw)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      unique.push({ slug, label: raw.trim() })
      if (unique.length >= TAGS_PER_POST) break
    }

    const tags = await Promise.all(
      unique.map((t) =>
        this.prisma.tag.upsert({
          where: { slug: t.slug },
          create: { slug: t.slug, label: t.label, isCurated: false },
          update: {},
        }),
      ),
    )

    await this.prisma.$transaction([
      this.prisma.inspirationTag.deleteMany({ where: { inspirationItemId: itemId } }),
      ...tags.map((tag) =>
        this.prisma.inspirationTag.create({
          data: { inspirationItemId: itemId, tagId: tag.id },
        }),
      ),
      this.prisma.inspirationItem.update({
        where: { id: itemId },
        data: { tags: tags.map((t) => t.slug) },
      }),
    ])
  }

  private async assertCanBeInspiration(postId: string, visibility: InspirationVisibility) {
    if (visibility !== InspirationVisibility.INSPIRATION) return
    const post = await this.prisma.inspirationItem.findUnique({
      where: { id: postId },
      select: { title: true, _count: { select: { media: true } } },
    })
    if (!post?.title.trim()) {
      throw new BadRequestException('Add a title before publishing to Inspiration')
    }
    if (post._count.media < 1) {
      throw new BadRequestException('Add at least one photo or link before publishing to Inspiration')
    }
  }

  async listMine(clerkId: string) {
    const { vendorProfileId } = await this.requireProfile(clerkId)
    const rows = await this.prisma.inspirationItem.findMany({
      where: { vendorProfileId },
      include: POST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapPost)
  }

  async create(clerkId: string, dto: CreateVendorPostDto) {
    const { userId, vendorProfileId } = await this.requireProfile(clerkId)
    const count = await this.prisma.inspirationItem.count({ where: { vendorProfileId } })
    if (count >= POSTS_PER_VENDOR) {
      throw new BadRequestException(`Portfolio is limited to ${POSTS_PER_VENDOR} posts`)
    }
    const visibility =
      dto.visibility === InspirationVisibility.INSPIRATION
        ? InspirationVisibility.PROFILE
        : (dto.visibility ?? InspirationVisibility.PROFILE)
    if (dto.visibility === InspirationVisibility.INSPIRATION) {
      throw new BadRequestException('Add media before publishing to Inspiration')
    }

    const created = await this.prisma.inspirationItem.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        category: dto.category,
        location: dto.location?.trim() || null,
        priceRangeFrom: dto.priceRangeFrom ?? null,
        priceRangeTo: dto.priceRangeTo ?? null,
        currency: dto.currency ?? 'CAD',
        costNote: dto.costNote?.trim() || null,
        visibility,
        vendorProfileId,
        createdById: userId,
        isAdminCurated: false,
      },
      include: POST_INCLUDE,
    })
    if (dto.tags?.length) await this.syncTags(created.id, dto.tags)
    const row = await this.prisma.inspirationItem.findUniqueOrThrow({
      where: { id: created.id },
      include: POST_INCLUDE,
    })
    return mapPost(row)
  }

  async update(clerkId: string, postId: string, dto: UpdateVendorPostDto) {
    await this.requireOwnedPost(clerkId, postId)
    if (dto.visibility) await this.assertCanBeInspiration(postId, dto.visibility)

    const data: Prisma.InspirationItemUpdateInput = {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.location !== undefined && { location: dto.location.trim() || null }),
      ...(dto.priceRangeFrom !== undefined && { priceRangeFrom: dto.priceRangeFrom }),
      ...(dto.priceRangeTo !== undefined && { priceRangeTo: dto.priceRangeTo }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.costNote !== undefined && { costNote: dto.costNote?.trim() || null }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
    }
    await this.prisma.inspirationItem.update({ where: { id: postId }, data })
    if (dto.tags) await this.syncTags(postId, dto.tags)
    const row = await this.prisma.inspirationItem.findUniqueOrThrow({
      where: { id: postId },
      include: POST_INCLUDE,
    })
    return mapPost(row)
  }

  async remove(clerkId: string, postId: string) {
    await this.requireOwnedPost(clerkId, postId)
    await this.prisma.inspirationItem.delete({ where: { id: postId } })
    return { deleted: true }
  }

  async addImage(clerkId: string, postId: string, url: string) {
    const { post } = await this.requireOwnedPost(clerkId, postId)
    if (post.media.length >= MEDIA_PER_POST) {
      throw new BadRequestException(`A post can have at most ${MEDIA_PER_POST} photos or links`)
    }
    const isCover = post.media.length === 0
    await this.prisma.inspirationMedia.create({
      data: {
        inspirationItemId: postId,
        url,
        mediaType: InspirationMediaType.IMAGE,
        isCover,
        sortOrder: post.media.length,
      },
    })
    if (isCover) {
      await this.prisma.inspirationItem.update({ where: { id: postId }, data: { imageUrl: url } })
    }
    return this.reload(postId)
  }

  async addExternal(clerkId: string, postId: string, url: string) {
    const { post } = await this.requireOwnedPost(clerkId, postId)
    if (post.media.length >= MEDIA_PER_POST) {
      throw new BadRequestException(`A post can have at most ${MEDIA_PER_POST} photos or links`)
    }
    const isCover = post.media.length === 0
    await this.prisma.inspirationMedia.create({
      data: {
        inspirationItemId: postId,
        url,
        mediaType: InspirationMediaType.EXTERNAL,
        isCover,
        sortOrder: post.media.length,
      },
    })
    if (isCover) {
      await this.prisma.inspirationItem.update({ where: { id: postId }, data: { imageUrl: url } })
    }
    return this.reload(postId)
  }

  async setCover(clerkId: string, postId: string, mediaId: string) {
    const { post } = await this.requireOwnedPost(clerkId, postId)
    const media = post.media.find((m) => m.id === mediaId)
    if (!media) throw new NotFoundException('Media not found')
    await this.prisma.$transaction([
      this.prisma.inspirationMedia.updateMany({
        where: { inspirationItemId: postId, isCover: true },
        data: { isCover: false },
      }),
      this.prisma.inspirationMedia.update({ where: { id: mediaId }, data: { isCover: true } }),
      this.prisma.inspirationItem.update({ where: { id: postId }, data: { imageUrl: media.url } }),
    ])
    return this.reload(postId)
  }

  async removeMedia(clerkId: string, postId: string, mediaId: string) {
    const { post } = await this.requireOwnedPost(clerkId, postId)
    const media = post.media.find((m) => m.id === mediaId)
    if (!media) throw new NotFoundException('Media not found')
    await this.prisma.inspirationMedia.delete({ where: { id: mediaId } })
    if (media.isCover) {
      const next = await this.prisma.inspirationMedia.findFirst({
        where: { inspirationItemId: postId },
        orderBy: { sortOrder: 'asc' },
      })
      if (next) {
        await this.prisma.inspirationMedia.update({ where: { id: next.id }, data: { isCover: true } })
        await this.prisma.inspirationItem.update({ where: { id: postId }, data: { imageUrl: next.url } })
      } else {
        await this.prisma.inspirationItem.update({
          where: { id: postId },
          data: { imageUrl: null, visibility: InspirationVisibility.PROFILE },
        })
      }
    }
    return this.reload(postId)
  }

  private async reload(postId: string) {
    const row = await this.prisma.inspirationItem.findUniqueOrThrow({
      where: { id: postId },
      include: POST_INCLUDE,
    })
    return mapPost(row)
  }
}
