import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common'
import { EventActivityAction, EventSurface, InspirationCategory, InspirationVisibility, NotificationType, Prisma, UserRole, VendorCategory } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { EmbeddingService } from './embedding.service'
import type { CreateInspirationDto } from './dto/create-inspiration.dto'
import { EventAccessService, ALL_SURFACES, type EventAccess } from '../events/event-access.service'
import { EventActivityService } from '../events/event-activity.service'
import { NotificationsService } from '../notifications/notifications.service'
import { POST_INCLUDE, mapPost } from './post-shape'
import { attachLookStats } from './look-stats'

// Re-export so controller can import from one place without emitDecoratorMetadata issues
export type { CreateInspirationDto }

// ─── Category affinity map (fallback when embeddings unavailable) ─────────────

const INSPIRATION_TO_VENDOR: Record<InspirationCategory, VendorCategory[]> = {
  PERFORMANCE: [VendorCategory.MC, VendorCategory.LIVE_BAND, VendorCategory.OTHER],
  VENUE:       [VendorCategory.WEDDING_PLANNER, VendorCategory.OTHER],
  DECOR:       [VendorCategory.DECORATOR],
  MUSIC:       [VendorCategory.DJ, VendorCategory.LIVE_BAND, VendorCategory.MC],
  FASHION:     [VendorCategory.FASHION_STYLIST, VendorCategory.MAKEUP_ARTIST],
  FOOD:        [VendorCategory.CATERER],
  OTHER:       [VendorCategory.OTHER],
}

// ─── Select shape (no `satisfies` — avoids namespace import requirement) ──────

const ITEM_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  tags: true,
  imageUrl: true,
  location: true,
  priceRangeFrom: true,
  priceRangeTo: true,
  currency: true,
  isAdminCurated: true,
  createdAt: true,
  vendorProfile: {
    select: {
      id: true, slug: true, businessName: true,
      isVerified: true, avatarUrl: true, city: true,
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
}

@Injectable()
export class InspirationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    private readonly access: EventAccessService,
    private readonly activity: EventActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  private feedWhere(category?: InspirationCategory, tag?: string): Prisma.InspirationItemWhereInput {
    return {
      visibility: InspirationVisibility.INSPIRATION,
      ...(category ? { category } : {}),
      ...(tag ? { tagLinks: { some: { tag: { slug: tag } } } } : {}),
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  async search(query: string, category?: InspirationCategory, limit = 20, tag?: string) {
    const q = query.trim()

    if (q && this.embedding.isConfigured) {
      const embBytes = await this.embedding.embedQuery(q)
      if (embBytes) return this.vectorSearch(embBytes, category, limit, tag)
    }

    return this.fulltextSearch(q, category, limit, tag)
  }

  private async vectorSearch(
    queryEmbedding: Uint8Array,
    category: InspirationCategory | undefined,
    limit: number,
    tag?: string,
  ) {
    const rows = await this.prisma.inspirationItem.findMany({
      where: { ...this.feedWhere(category, tag), embedding: { not: null } },
      include: POST_INCLUDE,
    })
    const embeddings = await this.prisma.inspirationItem.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, embedding: true },
    })
    const embById = new Map(embeddings.map((e) => [e.id, e.embedding]))

    if (rows.length === 0) return []

    const queryFloats = EmbeddingService.deserialize(queryEmbedding)

    const ranked = rows
      .map((row) => {
        const embedding = embById.get(row.id)
        if (!embedding) return null
        return {
          ...mapPost(row),
          _score: EmbeddingService.cosineSimilarity(
            queryFloats,
            EmbeddingService.deserialize(embedding as Uint8Array),
          ),
        }
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score: _, ...rest }) => rest)

    return attachLookStats(this.prisma, ranked)
  }

  // ─── Prisma-native text search (fallback) ────────────────────────────────────

  private async fulltextSearch(
    query: string,
    category: InspirationCategory | undefined,
    limit: number,
    tag?: string,
  ) {
    const where = this.feedWhere(category, tag)
    if (!query) {
      const rows = await this.prisma.inspirationItem.findMany({
        where,
        include: POST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return attachLookStats(this.prisma, rows.map(mapPost))
    }

    const terms = query.trim().split(/\s+/).filter(Boolean)

    const textOr = terms.flatMap((term) => [
      { title:       { contains: term, mode: 'insensitive' as const } },
      { description: { contains: term, mode: 'insensitive' as const } },
      { location:    { contains: term, mode: 'insensitive' as const } },
      { tags:        { has: term } },
    ])

    const rows = await this.prisma.inspirationItem.findMany({
      where: {
        AND: [where, { OR: textOr }],
      },
      include: POST_INCLUDE,
      orderBy: { isAdminCurated: 'desc' },
      take: limit,
    })
    return attachLookStats(this.prisma, rows.map(mapPost))
  }

  // ─── Browse all ───────────────────────────────────────────────────────────────

  async findAll(category?: InspirationCategory, limit = 40, tag?: string) {
    const rows = await this.prisma.inspirationItem.findMany({
      where: this.feedWhere(category, tag),
      include: POST_INCLUDE,
      orderBy: [{ isAdminCurated: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })
    return attachLookStats(this.prisma, rows.map(mapPost))
  }

  async listTags() {
    const [curated, used] = await Promise.all([
      this.prisma.tag.findMany({
        where: { isCurated: true },
        select: { slug: true, label: true, isCurated: true },
        orderBy: { label: 'asc' },
      }),
      this.prisma.tag.findMany({
        where: {
          isCurated: false,
          posts: { some: { inspirationItem: { visibility: InspirationVisibility.INSPIRATION } } },
        },
        select: { slug: true, label: true, isCurated: true },
        orderBy: { label: 'asc' },
      }),
    ])
    return [...curated, ...used]
  }

  async findOne(id: string, clerkId?: string) {
    const row = await this.prisma.inspirationItem.findUnique({
      where: { id },
      include: POST_INCLUDE,
    })
    if (!row) throw new NotFoundException('Inspiration item not found')
    if (row.visibility === InspirationVisibility.DRAFT) {
      if (!clerkId) throw new NotFoundException('Inspiration item not found')
      const user = await this.prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, vendorProfile: { select: { id: true } } },
      })
      const owns = user?.id === row.createdById || user?.vendorProfile?.id === row.vendorProfileId
      if (!owns) throw new NotFoundException('Inspiration item not found')
    }
    return (await attachLookStats(this.prisma, [mapPost(row)]))[0]
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  async create(clerkId: string, dto: CreateInspirationDto) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const text     = [dto.title, dto.description, ...(dto.tags ?? [])].join(' ')
    const embBytes = await this.embedding.embedDocument(text)

    return this.prisma.inspirationItem.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        tags: dto.tags ?? [],
        imageUrl: dto.imageUrl,
        location: dto.location,
        priceRangeFrom: dto.priceRangeFrom,
        priceRangeTo: dto.priceRangeTo,
        currency: dto.currency ?? 'CAD',
        vendorProfileId: dto.vendorProfileId,
        isAdminCurated: false,
        visibility: InspirationVisibility.INSPIRATION,
        createdById: user.id,
        ...(embBytes ? { embedding: embBytes as unknown as Uint8Array<ArrayBuffer> } : {}),
      },
      select: ITEM_SELECT,
    })
  }

  // ─── Mood board: save ─────────────────────────────────────────────────────────

  async saveToMoodBoard(
    clerkId: string,
    inspirationItemId: string,
    eventId: string,
    notes?: string,
    checklistItemId?: string,
    budgetItemId?: string,
    scheduleItemIds?: string[],
  ) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.MOODBOARD, action: 'edit' })
    const user = access.user

    const item = await this.prisma.inspirationItem.findUnique({
      where: { id: inspirationItemId },
      select: { visibility: true },
    })
    if (!item) throw new NotFoundException('Inspiration item not found')
    if (item.visibility === InspirationVisibility.DRAFT) {
      throw new BadRequestException('Draft posts cannot be saved to a mood board')
    }

    if (checklistItemId && !this.access.canSee(access, EventSurface.CHECKLIST)) {
      throw new NotFoundException('Event not found')
    }
    if (checklistItemId) {
      await this.access.assertCanSeeChecklistItem(access, checklistItemId)
    }
    if (budgetItemId && !this.access.canSee(access, EventSurface.BUDGET)) {
      throw new NotFoundException('Event not found')
    }
    if (scheduleItemIds?.length && !this.access.canSee(access, EventSurface.SCHEDULE)) {
      throw new NotFoundException('Event not found')
    }

    const uniqueScheduleIds = scheduleItemIds
      ? [...new Set(scheduleItemIds.filter(Boolean))]
      : undefined

    if (uniqueScheduleIds && uniqueScheduleIds.length > 0) {
      const count = await this.prisma.eventScheduleItem.count({
        where: { eventId, id: { in: uniqueScheduleIds } },
      })
      if (count !== uniqueScheduleIds.length) {
        throw new NotFoundException('Schedule item not found on this event')
      }
    }

    const scheduleLinkCreate = uniqueScheduleIds?.map((scheduleItemId) => ({ scheduleItemId }))

    const existing = await this.prisma.moodBoardItem.findFirst({
      where: { eventId, inspirationItemId },
    })

    if (existing) {
      return this.prisma.moodBoardItem.update({
        where: { id: existing.id },
        data: {
          notes,
          ...(checklistItemId !== undefined ? { checklistItemId } : {}),
          ...(budgetItemId !== undefined ? { budgetItemId } : {}),
          ...(scheduleLinkCreate !== undefined ? {
            scheduleLinks: {
              deleteMany: {},
              create: scheduleLinkCreate,
            },
          } : {}),
        },
      })
    }

    const created = await this.prisma.moodBoardItem.create({
      data: {
        userId: user.id,
        eventId,
        inspirationItemId,
        notes,
        checklistItemId: checklistItemId ?? null,
        budgetItemId: budgetItemId ?? null,
        ...(scheduleLinkCreate ? { scheduleLinks: { create: scheduleLinkCreate } } : {}),
      },
    })
    void this.activity.log({
      eventId,
      actorId: user.id,
      action: EventActivityAction.CREATED,
      surface: EventSurface.MOODBOARD,
      summary: `${user.firstName ?? 'Someone'} saved inspiration`,
      subjectType: 'MOOD_BOARD_ITEM',
      subjectId: created.id,
    })
    return created
  }

  // ─── Mood board: unsave ───────────────────────────────────────────────────────

  async removeFromMoodBoard(clerkId: string, inspirationItemId: string, eventId: string) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.MOODBOARD, action: 'edit' })

    await this.prisma.moodBoardItem.deleteMany({
      where: { eventId, inspirationItemId },
    })
    void this.activity.log({
      eventId,
      actorId: user.id,
      action: EventActivityAction.DELETED,
      surface: EventSurface.MOODBOARD,
      summary: `${user.firstName ?? 'Someone'} removed inspiration`,
      subjectType: 'MOOD_BOARD_ITEM',
      subjectId: inspirationItemId,
    })
    return { success: true }
  }

  // ─── Mood board: all saves the viewer can see ────────────────────────────────

  async getMyMoodBoard(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const [hosted, memberships] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.eventMember.findMany({
        where: {
          userId: user.id,
          acceptedAt: { not: null },
          event: { deletedAt: null },
        },
        select: { eventId: true, surfaces: true },
      }),
    ])

    const surfacesByEvent = new Map<string, EventSurface[]>()
    for (const e of hosted) surfacesByEvent.set(e.id, [...ALL_SURFACES])
    for (const m of memberships) {
      if (m.surfaces.includes(EventSurface.MOODBOARD) && !surfacesByEvent.has(m.eventId)) {
        surfacesByEvent.set(m.eventId, m.surfaces)
      }
    }

    const eventIds = [...surfacesByEvent.keys()]
    if (eventIds.length === 0) return []

    const rows = await this.prisma.moodBoardItem.findMany({
      where: { eventId: { in: eventIds } },
      include: {
        inspirationItem: { select: ITEM_SELECT },
        event: { select: { id: true, title: true } },
        checklistItem: { select: { id: true, title: true } },
        budgetItem: { select: { id: true, label: true, category: true } },
        scheduleLinks: {
          include: { scheduleItem: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return rows.map((row) => {
      const surfaces = surfacesByEvent.get(row.eventId) ?? []
      return this.projectMoodBoardRow(row, surfaces)
    })
  }

  // ─── Mood board: get for event ────────────────────────────────────────────────

  async getMoodBoard(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.MOODBOARD, action: 'view' })

    const rows = await this.prisma.moodBoardItem.findMany({
      where: { eventId },
      include: {
        inspirationItem: { select: ITEM_SELECT },
        checklistItem: { select: { id: true, title: true } },
        budgetItem: { select: { id: true, label: true, category: true } },
        scheduleLinks: {
          include: { scheduleItem: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => this.projectMoodBoardRow(row, access.surfaces, access))
  }

  // ─── Saved IDs ────────────────────────────────────────────────────────────────

  async getSavedIds(clerkId: string, eventId: string): Promise<string[]> {
    try {
      await this.access.require(clerkId, eventId, { surface: EventSurface.MOODBOARD, action: 'view' })
    } catch {
      return []
    }

    const items = await this.prisma.moodBoardItem.findMany({
      where: { eventId },
      select: { inspirationItemId: true },
    })
    return items.map((i) => i.inspirationItemId)
  }

  // ─── Mood board: get by checklist item ───────────────────────────────────────

  async getMoodBoardByChecklist(clerkId: string, checklistItemId: string) {
    const item = await this.prisma.eventChecklist.findFirst({
      where: { id: checklistItemId },
      select: { eventId: true },
    })
    if (!item) throw new NotFoundException('Event not found')
    const access = await this.access.require(clerkId, item.eventId, { surface: EventSurface.CHECKLIST, action: 'view' })
    await this.access.assertCanSeeChecklistItem(access, checklistItemId)
    if (!this.access.canSee(access, EventSurface.MOODBOARD)) return []

    return this.prisma.moodBoardItem.findMany({
      where: { checklistItemId },
      include: { inspirationItem: { select: ITEM_SELECT } },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── Mood board: get by budget item ──────────────────────────────────────────

  async getMoodBoardByBudget(clerkId: string, budgetItemId: string) {
    const item = await this.prisma.eventBudgetItem.findFirst({
      where: { id: budgetItemId },
      select: { eventId: true },
    })
    if (!item) throw new NotFoundException('Event not found')
    const access = await this.access.require(clerkId, item.eventId, { surface: EventSurface.BUDGET, action: 'view' })
    if (!this.access.canSee(access, EventSurface.MOODBOARD)) return []

    return this.prisma.moodBoardItem.findMany({
      where: { budgetItemId },
      include: { inspirationItem: { select: ITEM_SELECT } },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ─── Re-embed all (admin utility) ─────────────────────────────────────────────

  async requireAdmin(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { role: true },
    })
    if (user?.role !== UserRole.ADMIN) throw new NotFoundException('Not found')
  }

  async reEmbedAll(clerkId: string) {
    await this.requireAdmin(clerkId)
    if (!this.embedding.isConfigured) {
      return { skipped: true, reason: 'Azure OpenAI not configured' }
    }

    const items = await this.prisma.inspirationItem.findMany({
      select: { id: true, title: true, description: true, tags: true },
    })

    let count = 0
    for (const item of items) {
      const text  = [item.title, item.description, ...item.tags].join(' ')
      const bytes = await this.embedding.embedDocument(text)
      if (bytes) {
        await this.prisma.inspirationItem.update({
          where: { id: item.id },
          data: { embedding: bytes as unknown as Uint8Array<ArrayBuffer> },
        })
        count++
      }
    }

    return { embedded: count, total: items.length }
  }

  // ─── Re-embed all vendor profiles ─────────────────────────────────────────

  async reEmbedVendors(clerkId: string) {
    await this.requireAdmin(clerkId)
    if (!this.embedding.isConfigured) {
      return { skipped: true, reason: 'Azure OpenAI not configured' }
    }

    const vendors = await this.prisma.vendorProfile.findMany({
      select: { id: true, businessName: true, bio: true, category: true, categories: true },
    })

    let count = 0
    for (const v of vendors) {
      const text = [v.businessName, v.bio ?? '', v.category, ...v.categories].join(' ')
      const bytes = await this.embedding.embedDocument(text)
      if (bytes) {
        await this.prisma.vendorProfile.update({
          where: { id: v.id },
          data: { embedding: bytes as unknown as Uint8Array<ArrayBuffer> },
        })
        count++
      }
    }

    return { embedded: count, total: vendors.length }
  }

  // ─── Find matching vendors for an inspiration item ────────────────────────

  async getMatchingVendors(itemId: string, limit = 8) {
    const item = await this.prisma.inspirationItem.findUnique({
      where: { id: itemId },
      select: {
        category: true, tags: true, title: true, description: true,
        vendorProfileId: true, embedding: true, visibility: true,
      },
    })
    if (!item) throw new NotFoundException('Inspiration item not found')
    if (item.visibility === InspirationVisibility.DRAFT) {
      throw new NotFoundException('Inspiration item not found')
    }

    const VENDOR_SELECT = {
      id: true, slug: true, businessName: true,
      category: true, categories: true,
      bio: true, avatarUrl: true, city: true,
      isVerified: true, averageRating: true, totalReviews: true,
      estimatedPriceFrom: true, estimatedPriceTo: true, currency: true,
    }

    // ── Case 1: vendor-created → return that vendor directly ──────────────
    if (item.vendorProfileId) {
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { id: item.vendorProfileId, isActive: true },
        select: VENDOR_SELECT,
      })
      return vendor ? [{ ...vendor, _matchType: 'direct' as const, _score: 1 }] : []
    }

    // ── Case 2: semantic vector search (when embeddings available) ────────
    if (this.embedding.isConfigured && item.embedding) {
      const itemFloats = EmbeddingService.deserialize(item.embedding as Uint8Array)

      const vendors = await this.prisma.vendorProfile.findMany({
        where: { isActive: true, embedding: { not: null } },
        select: { ...VENDOR_SELECT, embedding: true },
      })

      if (vendors.length > 0) {
        return vendors
          .map(({ embedding, ...rest }) => ({
            ...rest,
            _matchType: 'semantic' as const,
            _score: EmbeddingService.cosineSimilarity(
              itemFloats,
              EmbeddingService.deserialize(embedding as Uint8Array),
            ),
          }))
          .sort((a, b) => b._score - a._score)
          .slice(0, limit)
          .filter((v) => v._score > 0.5)
      }
    }

    // ── Case 3: category affinity + keyword fallback ──────────────────────
    const affinityCategories = INSPIRATION_TO_VENDOR[item.category] ?? []
    const itemKeywords = [
      ...item.tags,
      ...item.title.toLowerCase().split(/\s+/),
      ...item.description.toLowerCase().split(/\s+/),
    ].filter((w) => w.length > 3)

    const candidates = await this.prisma.vendorProfile.findMany({
      where: {
        isActive: true,
        OR: [
          { category:   { in: affinityCategories } },
          { categories: { hasSome: affinityCategories } },
        ],
      },
      select: { ...VENDOR_SELECT, bio: true },
      take: 50,
    })

    return candidates
      .map((v) => {
        const haystack = [v.businessName, v.bio ?? '', v.category, ...v.categories]
          .join(' ').toLowerCase()
        const hits = itemKeywords.filter((kw) => haystack.includes(kw)).length
        return {
          ...v,
          _matchType: 'category' as const,
          _score: hits / Math.max(itemKeywords.length, 1),
        }
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
  }

  private projectMoodBoardRow<T extends {
    checklistItem: { id: string; title: string } | null
    budgetItem: { id: string; label: string | null; category: string } | null
    scheduleLinks: { scheduleItem: { id: string; title: string } }[]
  }>(row: T, surfaces: EventSurface[], access?: EventAccess) {
    const { scheduleLinks, ...rest } = row
    const isHost = access?.isHost ?? surfaces.length === ALL_SURFACES.length
    const can = (s: EventSurface) => isHost || surfaces.includes(s)
    return {
      ...rest,
      checklistItem: can(EventSurface.CHECKLIST) ? row.checklistItem : null,
      budgetItem: can(EventSurface.BUDGET) ? row.budgetItem : null,
      scheduleItems: can(EventSurface.SCHEDULE)
        ? scheduleLinks.map((link) => link.scheduleItem)
        : [],
    }
  }

  private toMoodBoardDto<T extends {
    scheduleLinks: { scheduleItem: { id: string; title: string } }[]
  }>(row: T) {
    const { scheduleLinks, ...rest } = row
    return {
      ...rest,
      scheduleItems: scheduleLinks.map((link) => link.scheduleItem),
    }
  }

  private commentSelect = {
    id: true,
    body: true,
    createdAt: true,
    author: {
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    },
  } as const

  private async requireVisiblePost(id: string) {
    const post = await this.prisma.inspirationItem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        visibility: true,
        vendorProfile: { select: { userId: true } },
      },
    })
    if (!post || post.visibility === InspirationVisibility.DRAFT) {
      throw new NotFoundException('Inspiration item not found')
    }
    return post
  }

  async listComments(itemId: string) {
    await this.requireVisiblePost(itemId)
    return this.prisma.inspirationComment.findMany({
      where: { inspirationItemId: itemId },
      select: this.commentSelect,
      orderBy: { createdAt: 'asc' },
    })
  }

  async addComment(clerkId: string, itemId: string, body: string) {
    const text = body.trim()
    if (!text) throw new BadRequestException('Comment cannot be empty')
    const post = await this.requireVisiblePost(itemId)
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const comment = await this.prisma.inspirationComment.create({
      data: { inspirationItemId: itemId, authorId: user.id, body: text },
      select: this.commentSelect,
    })

    const vendorUserId = post.vendorProfile?.userId
    if (vendorUserId && vendorUserId !== user.id) {
      const who = user.firstName ?? 'Someone'
      await this.notifications.create(
        vendorUserId,
        NotificationType.INSPIRATION_COMMENT,
        'New comment on your look',
        `${who} commented on “${post.title}”.`,
        { inspirationItemId: itemId, href: `/inspiration?item=${itemId}` },
      )
    }

    return comment
  }

  async deleteComment(clerkId: string, itemId: string, commentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const comment = await this.prisma.inspirationComment.findFirst({
      where: { id: commentId, inspirationItemId: itemId },
      select: {
        id: true,
        authorId: true,
        inspirationItem: { select: { vendorProfileId: true } },
      },
    })
    if (!comment) throw new NotFoundException('Comment not found')

    const isAuthor = comment.authorId === user.id
    const isVendor = !!user.vendorProfile && comment.inspirationItem.vendorProfileId === user.vendorProfile.id
    if (!isAuthor && !isVendor) throw new ForbiddenException('You cannot delete this comment')

    await this.prisma.inspirationComment.delete({ where: { id: commentId } })
    return { deleted: true }
  }

  async like(clerkId: string, inspirationItemId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const item = await this.prisma.inspirationItem.findUnique({
      where: { id: inspirationItemId },
      select: { id: true, visibility: true },
    })
    if (!item || item.visibility === InspirationVisibility.DRAFT) {
      throw new NotFoundException('Inspiration item not found')
    }

    await this.prisma.inspirationLike.upsert({
      where: {
        userId_inspirationItemId: { userId: user.id, inspirationItemId },
      },
      create: { userId: user.id, inspirationItemId },
      update: {},
    })

    const likeCount = await this.prisma.inspirationLike.count({ where: { inspirationItemId } })
    return { liked: true, likeCount }
  }

  async unlike(clerkId: string, inspirationItemId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) throw new NotFoundException('User not found')

    await this.prisma.inspirationLike.deleteMany({
      where: { userId: user.id, inspirationItemId },
    })

    const likeCount = await this.prisma.inspirationLike.count({ where: { inspirationItemId } })
    return { liked: false, likeCount }
  }

  async getLiked(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) throw new NotFoundException('User not found')

    const rows = await this.prisma.inspirationLike.findMany({
      where: {
        userId: user.id,
        inspirationItem: { visibility: { not: InspirationVisibility.DRAFT } },
      },
      orderBy: { createdAt: 'desc' },
      include: { inspirationItem: { include: POST_INCLUDE } },
    })

    return attachLookStats(this.prisma, rows.map((row) => mapPost(row.inspirationItem)))
  }

  async getLikedIds(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    })
    if (!user) return []

    const rows = await this.prisma.inspirationLike.findMany({
      where: { userId: user.id },
      select: { inspirationItemId: true },
    })
    return rows.map((row) => row.inspirationItemId)
  }
}
