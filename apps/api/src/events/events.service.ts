import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { basename } from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { BlobStorageService } from '../uploads/blob-storage.service'
import { EventActivityAction, EventSurface, VendorCategory } from '@prisma/client'
import { AttachChildEventDto, CreateChildEventDto, ReorderChildrenDto } from './dto/children.dto'
import { CreateEventDto } from './dto/create-event.dto'
import { CreateChecklistItemDto, UpdateChecklistItemDto } from './dto/checklist.dto'
import { CreateBudgetItemDto, UpdateBudgetItemDto } from './dto/budget.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { CreateScheduleItemDto, UpdateScheduleItemDto } from './dto/schedule.dto'
import { EventAccessService, ALL_SURFACES, viewerDto, type EventAccess } from './event-access.service'
import { EventActivityService, OPENED_SURFACE } from './event-activity.service'

const SCHEDULE_INCLUDE = {
  budgetLinks: {
    include: {
      budgetItem: {
        select: { id: true, label: true, vendorName: true, category: true, allocatedAmount: true },
      },
    },
  },
  checklistLinks: {
    include: {
      checklistItem: {
        select: {
          id: true,
          title: true,
          isCompleted: true,
          concealments: { select: { eventMemberId: true } },
        },
      },
    },
  },
} as const

export function receiptProxyUrl(eventId: string, itemId: string, receiptId: string) {
  return `/api/proxy/events/${eventId}/budget/${itemId}/receipts/${receiptId}/file`
}

export function rewriteReceiptUrls<T extends { id: string; receipts?: { id: string; url: string }[] }>(
  eventId: string,
  items: T[],
): T[] {
  return items.map((item) => ({
    ...item,
    receipts: (item.receipts ?? []).map((receipt) => ({
      ...receipt,
      url: receiptProxyUrl(eventId, item.id, receipt.id),
    })),
  }))
}

const DEFAULT_BUDGET_SPLIT: Record<VendorCategory, number> = {
  CATERER: 0.30,
  PHOTOGRAPHER: 0.12,
  VIDEOGRAPHER: 0.08,
  DECORATOR: 0.15,
  DJ: 0.08,
  MAKEUP_ARTIST: 0.07,
  MC: 0.05,
  WEDDING_PLANNER: 0.05,
  FASHION_STYLIST: 0.05,
  LIVE_BAND: 0.03,
  OTHER: 0.02,
}

const EVENT_DETAIL_INCLUDE = {
  budgetItems: {
    orderBy: { category: 'asc' as const },
    include: { receipts: { orderBy: { createdAt: 'asc' as const } } },
  },
  checklist: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true } },
      concealments: { select: { eventMemberId: true } },
    },
  },
  schedule: {
    orderBy: [{ startTime: 'asc' as const }, { sortOrder: 'asc' as const }],
    include: SCHEDULE_INCLUDE,
  },
  inquiries: { select: { id: true, status: true, vendorProfileId: true } },
}

function recencyMs(
  event: { id: string; createdAt: Date; updatedAt?: Date },
  openedAt: Map<string, number>,
) {
  const updated = (event.updatedAt ?? event.createdAt).getTime()
  return Math.max(updated, openedAt.get(event.id) ?? 0)
}

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private activity: EventActivityService,
    private storage: BlobStorageService,
  ) {}

  private track(
    eventId: string,
    actorId: string,
    action: EventActivityAction,
    surface: EventSurface,
    summary: string,
    subjectType?: string,
    subjectId?: string,
  ) {
    void this.activity.log({ eventId, actorId, action, surface, summary, subjectType, subjectId })
  }

  async create(clerkId: string, dto: CreateEventDto) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const event = await this.prisma.event.create({
      data: {
        userId: user.id,
        title: dto.title,
        eventType: dto.eventType,
        tribes: dto.tribes,
        themes: dto.themes,
        totalBudget: dto.totalBudget,
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
        guestCount: dto.guestCount ?? null,
        location: dto.location ?? 'Ottawa, Ontario, Canada',
        budgetItems: {
          create: Object.entries(DEFAULT_BUDGET_SPLIT).map(([category, ratio]) => ({
            category: category as VendorCategory,
            allocatedAmount: Math.round(dto.totalBudget * ratio),
            spentAmount: 0,
          })),
        },
        checklist: {
          create: this.getDefaultChecklist(dto.tribes),
        },
      },
      include: {
        budgetItems: true,
        checklist: true,
        schedule: true,
      },
    })

    return {
      ...event,
      viewer: { isHost: true as const, role: 'HOST' as const, surfaces: [...ALL_SURFACES] },
    }
  }

  async findById(clerkId: string, eventId: string, assignedToMe = false) {
    const access = await this.access.require(clerkId, eventId)
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: EVENT_DETAIL_INCLUDE,
    })
    if (!event) return event
    void this.activity.recordOpen(access.user.id, eventId)
    const tree = await this.projectTree(access)
    return { ...this.projectEvent(event, access, assignedToMe), ...tree }
  }

  async updateEvent(clerkId: string, eventId: string, dto: UpdateEventDto) {
    const { event } = await this.access.require(clerkId, eventId, { action: 'host' })

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.estimatedDate !== undefined && {
          estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
        }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.guestCount !== undefined && { guestCount: dto.guestCount }),
        ...(dto.totalBudget !== undefined && { totalBudget: dto.totalBudget }),
      },
    })
  }

  private async projectTree(access: EventAccess) {
    const event = access.event
    const parent = event.parentId
      ? await this.prisma.event.findFirst({
          where: { id: event.parentId, deletedAt: null },
          select: { id: true, title: true },
        })
      : null

    if (event.parentId) {
      return { parent, children: [] as const, treeBudget: null }
    }

    const children = await this.prisma.event.findMany({
      where: { parentId: event.id, deletedAt: null },
      orderBy: [{ estimatedDate: 'asc' }, { sortOrder: 'asc' }],
      include: { budgetItems: { select: { spentAmount: true } } },
    })

    const grants = !access.isHost && access.memberId
      ? await this.prisma.eventSubGrant.findMany({
          where: { eventMemberId: access.memberId, eventId: { in: children.map((c) => c.id) } },
        })
      : []
    const grantByChild = new Map(grants.map((g) => [g.eventId, g]))
    const visible = access.isHost
      ? children
      : children.filter((child) => grantByChild.has(child.id))

    const journey = visible.map((child) => ({
      id: child.id,
      title: child.title,
      eventType: child.eventType,
      tribes: child.tribes,
      estimatedDate: child.estimatedDate,
      location: child.location,
      sortOrder: child.sortOrder,
      isCompleted: child.isCompleted,
      allocatedBudget: this.access.canSee(access, EventSurface.BUDGET)
        || grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET)
        ? child.totalBudget
        : undefined,
      spentAmount: this.access.canSee(access, EventSurface.BUDGET)
        || grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET)
        ? child.budgetItems.reduce((sum, item) => sum + item.spentAmount, 0)
        : undefined,
    }))

    const budgetChildren = visible.filter((child) => (
      access.isHost
      || this.access.canSee(access, EventSurface.BUDGET)
      || Boolean(grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET))
    ))

    return {
      parent,
      children: journey,
      treeBudget: children.length === 0
        ? null
        : {
            pot: this.access.canSee(access, EventSurface.BUDGET) ? event.totalBudget : 0,
            envelopesTotal: budgetChildren.reduce((sum, child) => sum + child.totalBudget, 0),
            spentTotal: budgetChildren.reduce(
              (sum, child) => sum + child.budgetItems.reduce((acc, item) => acc + item.spentAmount, 0),
              0,
            ),
          },
    }
  }

  private async requireParentHost(clerkId: string, parentId: string) {
    const access = await this.access.require(clerkId, parentId, { action: 'host' })
    if (access.event.parentId) {
      throw new BadRequestException('Sub-events cannot have their own sub-events')
    }
    return access
  }

  async addChild(clerkId: string, parentId: string, dto: CreateChildEventDto) {
    const { user, event: parent } = await this.requireParentHost(clerkId, parentId)
    const envelope = dto.allocatedBudget ?? 0

    const last = await this.prisma.event.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    return this.prisma.event.create({
      data: {
        userId: parent.userId,
        parentId,
        title: dto.title,
        eventType: dto.eventType,
        tribes: dto.tribes,
        themes: dto.themes,
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
        location: dto.location,
        guestCount: dto.guestCount ?? null,
        totalBudget: envelope,
        currency: parent.currency,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        budgetItems: {
          create: Object.entries(DEFAULT_BUDGET_SPLIT).map(([category, ratio]) => ({
            category: category as VendorCategory,
            allocatedAmount: Math.round(envelope * ratio),
            spentAmount: 0,
          })),
        },
      },
    }).then(async (created) => {
      this.track(
        parentId,
        user.id,
        EventActivityAction.CREATED,
        EventSurface.SCHEDULE,
        `Added sub-event “${created.title}”`,
        'EVENT',
        created.id,
      )
      return this.findById(clerkId, parentId)
    })
  }

  async attachChild(clerkId: string, parentId: string, dto: AttachChildEventDto) {
    const { user, event: parent } = await this.requireParentHost(clerkId, parentId)
    const child = await this.prisma.event.findFirst({
      where: { id: dto.eventId, deletedAt: null },
    })
    if (!child || child.userId !== user.id) throw new NotFoundException('Event not found')
    if (child.id === parentId) throw new BadRequestException('An event cannot contain itself')
    if (child.parentId) throw new BadRequestException('That event already belongs to another event')
    const nested = await this.prisma.event.count({
      where: { parentId: child.id, deletedAt: null },
    })
    if (nested > 0) throw new BadRequestException('Sub-events cannot have their own sub-events')

    const last = await this.prisma.event.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })

    await this.prisma.event.update({
      where: { id: child.id },
      data: { parentId, sortOrder: (last?.sortOrder ?? 0) + 1, currency: parent.currency },
    })
    return this.findById(clerkId, parentId)
  }

  async reorderChildren(clerkId: string, parentId: string, dto: ReorderChildrenDto) {
    await this.requireParentHost(clerkId, parentId)
    const children = await this.prisma.event.findMany({
      where: { parentId, deletedAt: null, id: { in: dto.eventIds } },
      select: { id: true },
    })
    if (children.length !== dto.eventIds.length) {
      throw new BadRequestException('Can only reorder sub-events of this event')
    }
    await this.prisma.$transaction(
      dto.eventIds.map((id, index) =>
        this.prisma.event.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
    return this.findById(clerkId, parentId)
  }

  async detachChild(clerkId: string, parentId: string, childId: string) {
    await this.requireParentHost(clerkId, parentId)
    const child = await this.prisma.event.findFirst({
      where: { id: childId, parentId, deletedAt: null },
    })
    if (!child) throw new NotFoundException('Event not found')
    await this.prisma.eventSubGrant.deleteMany({ where: { eventId: childId } })
    await this.prisma.event.update({
      where: { id: childId },
      data: { parentId: null },
    })
    return this.findById(clerkId, parentId)
  }

  async softDelete(clerkId: string, eventId: string) {
    const { user, event } = await this.access.require(clerkId, eventId, { action: 'host' })
    const childIds = event.parentId
      ? []
      : (await this.prisma.event.findMany({
          where: { parentId: eventId, deletedAt: null },
          select: { id: true },
        })).map((child) => child.id)

    await this.prisma.event.updateMany({
      where: { id: { in: [eventId, ...childIds] }, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      EventSurface.SCHEDULE,
      `Deleted “${event.title}”`,
      'EVENT',
      eventId,
    )
    return { ok: true as const }
  }

  async findByUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const listInclude = {
      parent: { select: { id: true, title: true } },
      budgetItems: { include: { receipts: true, userVendorContact: true } },
      checklist: { include: { userVendorContact: true, vendorProfile: { select: { id: true, businessName: true, isVerified: true, slug: true } } } },
      schedule: {
        orderBy: [{ startTime: 'asc' as const }, { sortOrder: 'asc' as const }],
        include: SCHEDULE_INCLUDE,
      },
    }

    const [hosted, memberships, grants] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId: user.id, deletedAt: null },
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.eventMember.findMany({
        where: { userId: user.id, acceptedAt: { not: null }, event: { deletedAt: null } },
        include: { event: { include: listInclude } },
      }),
      this.prisma.eventSubGrant.findMany({
        where: {
          member: {
            acceptedAt: { not: null },
            OR: [
              { userId: user.id },
              { email: { equals: user.email, mode: 'insensitive' } },
            ],
            event: { deletedAt: null },
          },
          event: { deletedAt: null },
        },
        include: {
          event: { include: listInclude },
          member: { select: { id: true, role: true } },
        },
      }),
    ])

    const hostedIds = new Set(hosted.map((e) => e.id))
    const hostedProjected = hosted.map((event) =>
      this.projectEvent(event, {
        user,
        event,
        isHost: true,
        role: 'HOST',
        surfaces: [...ALL_SURFACES],
      }),
    )
    const seen = new Set(hostedIds)
    const memberProjected = memberships
      .filter((m) => !seen.has(m.eventId))
      .map((m) => {
        seen.add(m.eventId)
        return this.projectEvent(m.event, {
          user,
          event: m.event,
          isHost: false,
          role: m.role,
          surfaces: m.surfaces,
          memberId: m.id,
        })
      })
    const grantProjected = grants
      .filter((g) => !seen.has(g.eventId))
      .map((g) =>
        this.projectEvent(g.event, {
          user,
          event: g.event,
          isHost: false,
          role: g.member.role,
          surfaces: g.surfaces,
          memberId: g.member.id,
        }),
      )

    const combined = [...hostedProjected, ...memberProjected, ...grantProjected]
    const opened = await this.prisma.eventSurfaceRead.findMany({
      where: {
        userId: user.id,
        surface: OPENED_SURFACE,
        eventId: { in: combined.map((e) => e.id) },
      },
      select: { eventId: true, seenAt: true },
    })
    const openedAt = new Map(opened.map((row) => [row.eventId, row.seenAt.getTime()]))

    return combined.sort((a, b) => recencyMs(b, openedAt) - recencyMs(a, openedAt))
  }

  // ─── Budget items ────────────────────────────────────────────────────────────

  async listBudget(clerkId: string, eventId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'view' })

    return this.prisma.eventBudgetItem.findMany({
      where: { eventId },
      orderBy: { category: 'asc' },
      select: { id: true, label: true, vendorName: true, category: true },
    })
  }

  async addBudgetItem(clerkId: string, eventId: string, dto: CreateBudgetItemDto) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })

    // Only link to a vendor profile if it actually exists — never create one.
    const safeVendorProfileId = dto.vendorProfileId
      ? (await this.prisma.vendorProfile.findUnique({ where: { id: dto.vendorProfileId }, select: { id: true } }))?.id ?? null
      : null

    // Validate userVendorContactId belongs to this user
    const safeContactId = dto.userVendorContactId
      ? (await this.prisma.userVendorContact.findFirst({
          where: { id: dto.userVendorContactId, userId: user.id },
          select: { id: true },
        }))?.id ?? null
      : null

    const created = await this.prisma.eventBudgetItem.create({
      data: {
        eventId,
        category: dto.category,
        label: dto.label ?? null,
        vendorName: dto.vendorName ?? null,
        vendorProfileId: safeVendorProfileId,
        userVendorContactId: safeContactId,
        notes: dto.notes ?? null,
        allocatedAmount: dto.allocatedAmount,
        spentAmount: dto.spentAmount ?? 0,
      },
      include: {
        receipts: true,
        userVendorContact: true,
      },
    })
    this.track(
      eventId,
      user.id,
      EventActivityAction.CREATED,
      EventSurface.BUDGET,
      `Added budget item “${created.label || created.vendorName || created.category}”`,
      'BUDGET_ITEM',
      created.id,
    )
    return created
  }

  async updateBudgetItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateBudgetItemDto,
  ) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })

    const existing = await this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Budget item not found')

    // Resolve vendorProfileId safely
    let safeVendorProfileId: string | null | undefined = undefined
    if (dto.vendorProfileId !== undefined) {
      safeVendorProfileId = dto.vendorProfileId
        ? (await this.prisma.vendorProfile.findUnique({ where: { id: dto.vendorProfileId }, select: { id: true } }))?.id ?? null
        : null
    }

    // Resolve userVendorContactId safely
    let safeContactId: string | null | undefined = undefined
    if (dto.userVendorContactId !== undefined) {
      safeContactId = dto.userVendorContactId
        ? (await this.prisma.userVendorContact.findFirst({
            where: { id: dto.userVendorContactId, userId: user.id },
            select: { id: true },
          }))?.id ?? null
        : null
    }

    // When linking to a registered profile, clear the personal contact link and vice versa
    const vendorProfileUpdate = safeVendorProfileId !== undefined
      ? { vendorProfileId: safeVendorProfileId, ...(safeVendorProfileId !== null ? { userVendorContactId: null } : {}) }
      : {}
    const contactUpdate = safeContactId !== undefined
      ? { userVendorContactId: safeContactId, ...(safeContactId !== null ? { vendorProfileId: null } : {}) }
      : {}

    const updated = await this.prisma.eventBudgetItem.update({
      where: { id: itemId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.vendorName !== undefined && { vendorName: dto.vendorName }),
        ...vendorProfileUpdate,
        ...contactUpdate,
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.allocatedAmount !== undefined && { allocatedAmount: dto.allocatedAmount }),
        ...(dto.spentAmount !== undefined && { spentAmount: dto.spentAmount }),
      },
      include: {
        receipts: true,
        userVendorContact: true,
      },
    })
    this.track(
      eventId,
      user.id,
      EventActivityAction.UPDATED,
      EventSurface.BUDGET,
      `Updated budget item “${updated.label || updated.vendorName || updated.category}”`,
      'BUDGET_ITEM',
      updated.id,
    )
    return updated
  }

  async deleteBudgetItem(clerkId: string, eventId: string, itemId: string) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })

    const existing = await this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, label: true, vendorName: true, category: true },
    })
    if (!existing) throw new NotFoundException('Budget item not found')

    const deleted = await this.prisma.eventBudgetItem.delete({ where: { id: itemId } })
    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      EventSurface.BUDGET,
      `Removed budget item “${existing.label || existing.vendorName || existing.category}”`,
      'BUDGET_ITEM',
      itemId,
    )
    return deleted
  }

  async addReceipt(
    clerkId: string,
    eventId: string,
    itemId: string,
    filename: string,
    url: string,
    mimeType?: string,
    fileSize?: number,
  ) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })

    const item = await this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
    })
    if (!item) throw new NotFoundException('Budget item not found')

    const created = await this.prisma.budgetReceipt.create({
      data: {
        budgetItemId: itemId,
        filename,
        url: `private/${basename(url)}`,
        mimeType: mimeType ?? null,
        fileSize: fileSize ?? null,
      },
    })
    return { ...created, url: receiptProxyUrl(eventId, itemId, created.id) }
  }

  async openReceiptFile(clerkId: string, eventId: string, itemId: string, receiptId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'view' })

    const receipt = await this.prisma.budgetReceipt.findFirst({
      where: { id: receiptId, budgetItemId: itemId, budgetItem: { eventId } },
    })
    if (!receipt) throw new NotFoundException('Receipt not found')

    const name = basename(receipt.url.split('?')[0] ?? '')
    const kind = receipt.url.includes('private/') || receipt.url.startsWith('private/')
      ? 'receipts'
      : name.startsWith('receipt-')
        ? 'images'
        : null
    const stream = kind ? await this.storage.download(kind, name) : null
    if (!stream) throw new NotFoundException('Receipt not found')

    return {
      stream,
      mimeType: receipt.mimeType ?? 'application/octet-stream',
      filename: receipt.filename,
    }
  }

  async deleteReceipt(clerkId: string, eventId: string, receiptId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })

    const receipt = await this.prisma.budgetReceipt.findFirst({
      where: { id: receiptId },
      include: { budgetItem: true },
    })
    if (!receipt || receipt.budgetItem.eventId !== eventId) {
      throw new NotFoundException('Receipt not found')
    }

    const deleted = await this.prisma.budgetReceipt.delete({ where: { id: receiptId } })
    const name = basename(receipt.url.split('?')[0] ?? '')
    if (receipt.url.includes('private/') || receipt.url.startsWith('private/')) {
      await this.storage.delete('receipts', name)
    } else if (name.startsWith('receipt-')) {
      await this.storage.delete('images', name)
    }
    return deleted
  }

  async listChecklist(clerkId: string, eventId: string, assignedToMe = false) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.CHECKLIST, action: 'view' })

    const rows = await this.prisma.eventChecklist.findMany({
      where: {
        eventId,
        ...(assignedToMe ? { assigneeUserId: access.user.id } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        concealments: { select: { eventMemberId: true } },
      },
    })

    return rows
      .filter((row) => this.access.canSeeChecklistRow(access, row.concealments))
      .map((row) => ({ id: row.id, title: row.title }))
  }

  async addChecklistItem(clerkId: string, eventId: string, dto: CreateChecklistItemDto) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.CHECKLIST, action: 'edit' })

    const last = await this.prisma.eventChecklist.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
    })

    // Validate vendor FKs — only link if they actually exist
    const safeVendorProfileId = dto.vendorProfileId
      ? (await this.prisma.vendorProfile.findUnique({ where: { id: dto.vendorProfileId }, select: { id: true } }))?.id ?? null
      : null

    const safeContactId = dto.userVendorContactId
      ? (await this.prisma.userVendorContact.findFirst({
          where: { id: dto.userVendorContactId, userId: user.id },
          select: { id: true },
        }))?.id ?? null
      : null

    const created = await this.prisma.eventChecklist.create({
      data: {
        eventId,
        title: dto.title,
        description: dto.description ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        notifyByEmail: dto.notifyByEmail ?? false,
        notifyBySms: dto.notifyBySms ?? false,
        needsVendor: dto.needsVendor ?? false,
        vendorCategory: dto.vendorCategory ?? null,
        vendorProfileId: safeVendorProfileId,
        userVendorContactId: safeContactId,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
      include: { userVendorContact: true, vendorProfile: { select: { id: true, businessName: true, isVerified: true, slug: true } } },
    })
    this.track(
      eventId,
      user.id,
      EventActivityAction.CREATED,
      EventSurface.CHECKLIST,
      `Added checklist item “${created.title}”`,
      'CHECKLIST_ITEM',
      created.id,
    )
    return created
  }

  async updateChecklistItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.CHECKLIST, action: 'edit' })
    const { user } = access
    await this.access.assertCanSeeChecklistItem(access, itemId)

    const existing = await this.prisma.eventChecklist.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, isCompleted: true },
    })
    if (!existing) throw new NotFoundException('Checklist item not found')

    if (dto.hiddenFromMemberIds !== undefined) {
      if (!access.isHost) {
        throw new ForbiddenException('Only the host can hide checklist rows')
      }
      await this.access.assertConcealmentTargets(eventId, dto.hiddenFromMemberIds)
    }

    if (dto.assigneeUserId !== undefined || dto.hiddenFromMemberIds !== undefined) {
      const assignee = dto.assigneeUserId !== undefined
        ? dto.assigneeUserId
        : (await this.prisma.eventChecklist.findFirst({
            where: { id: itemId },
            select: { assigneeUserId: true },
          }))?.assigneeUserId ?? null
      await this.assertAssignee(eventId, assignee, dto.hiddenFromMemberIds, itemId)
    }
    let safeVendorProfileId: string | null | undefined = undefined
    if (dto.vendorProfileId !== undefined) {
      safeVendorProfileId = dto.vendorProfileId
        ? (await this.prisma.vendorProfile.findUnique({ where: { id: dto.vendorProfileId }, select: { id: true } }))?.id ?? null
        : null
    }

    let safeContactId: string | null | undefined = undefined
    if (dto.userVendorContactId !== undefined) {
      safeContactId = dto.userVendorContactId
        ? (await this.prisma.userVendorContact.findFirst({
            where: { id: dto.userVendorContactId, userId: user.id },
            select: { id: true },
          }))?.id ?? null
        : null
    }

    // Linking one clears the other
    const vendorProfileUpdate = safeVendorProfileId !== undefined
      ? { vendorProfileId: safeVendorProfileId, ...(safeVendorProfileId !== null ? { userVendorContactId: null } : {}) }
      : {}
    const contactUpdate = safeContactId !== undefined
      ? { userVendorContactId: safeContactId, ...(safeContactId !== null ? { vendorProfileId: null } : {}) }
      : {}

    const updated = await this.prisma.eventChecklist.update({
      where: { id: itemId },
      data: {
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notifiedAt: null,
        }),
        ...(dto.notifyByEmail !== undefined && { notifyByEmail: dto.notifyByEmail }),
        ...(dto.notifyBySms !== undefined && { notifyBySms: dto.notifyBySms }),
        ...(dto.needsVendor !== undefined && { needsVendor: dto.needsVendor }),
        ...(dto.vendorCategory !== undefined && { vendorCategory: dto.vendorCategory }),
        ...vendorProfileUpdate,
        ...contactUpdate,
        ...(dto.assigneeUserId !== undefined && { assigneeUserId: dto.assigneeUserId }),
      },
      include: { userVendorContact: true, vendorProfile: { select: { id: true, businessName: true, isVerified: true, slug: true } } },
    })
    if (dto.hiddenFromMemberIds !== undefined) {
      await this.prisma.eventChecklistConcealment.deleteMany({ where: { checklistId: itemId } })
      if (dto.hiddenFromMemberIds.length > 0) {
        await this.prisma.eventChecklistConcealment.createMany({
          data: dto.hiddenFromMemberIds.map((eventMemberId) => ({
            checklistId: itemId,
            eventMemberId,
          })),
        })
      }
    }
    const homeSync: { title?: string; isCompleted?: boolean; dueDate?: Date | null } = {}
    if (dto.title !== undefined) homeSync.title = updated.title
    if (dto.isCompleted !== undefined) homeSync.isCompleted = updated.isCompleted
    if (dto.dueDate !== undefined) homeSync.dueDate = updated.dueDate
    if (Object.keys(homeSync).length > 0) {
      await this.prisma.userChecklist.updateMany({
        where: { eventChecklistId: itemId },
        data: homeSync,
      })
    }
    const action = dto.isCompleted === true && !existing.isCompleted
      ? EventActivityAction.COMPLETED
      : EventActivityAction.UPDATED
    this.track(
      eventId,
      user.id,
      action,
      EventSurface.CHECKLIST,
      action === EventActivityAction.COMPLETED
        ? `Completed “${updated.title}”`
        : `Updated checklist item “${updated.title}”`,
      'CHECKLIST_ITEM',
      updated.id,
    )
    return updated
  }

  async deleteChecklistItem(clerkId: string, eventId: string, itemId: string) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.CHECKLIST, action: 'edit' })
    const { user } = access
    await this.access.assertCanSeeChecklistItem(access, itemId)

    const existing = await this.prisma.eventChecklist.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, title: true },
    })
    if (!existing) throw new NotFoundException('Checklist item not found')

    await this.prisma.userChecklist.deleteMany({ where: { eventChecklistId: itemId } })
    const deleted = await this.prisma.eventChecklist.delete({ where: { id: itemId } })
    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      EventSurface.CHECKLIST,
      `Removed checklist item “${existing.title}”`,
      'CHECKLIST_ITEM',
      itemId,
    )
    return deleted
  }

  // ─── Schedule ─────────────────────────────────────────────────────────

  private emptyToNull(value?: string | null) {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }

  private normalizeTime(value?: string | null) {
    const v = this.emptyToNull(value)
    return v ? v.slice(0, 5) : null
  }

  private normalizeDate(value?: string | null) {
    const v = this.emptyToNull(value)
    return v ? v.slice(0, 10) : null
  }

  private resolveScheduleDate(
    event: { parentId: string | null },
    incoming: string | null | undefined,
    { required }: { required: boolean },
  ) {
    if (event.parentId) {
      if (incoming != null && String(incoming).trim() !== '') {
        throw new BadRequestException('Sub-event schedule blocks cannot have a date')
      }
      return null
    }
    const date = this.normalizeDate(incoming)
    if (required && !date) {
      throw new BadRequestException("Date is required on this event's schedule")
    }
    return date
  }

  private uniqueIds(ids?: string[]) {
    if (!ids) return []
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  }

  private toScheduleDto<
    T extends {
      budgetLinks: { budgetItem: { id: string; label: string | null; vendorName: string | null; category: VendorCategory; allocatedAmount: number } }[]
      checklistLinks: {
        checklistItem: {
          id: string
          title: string
          isCompleted: boolean
          concealments?: { eventMemberId: string }[]
        }
      }[]
    },
  >(item: T, access?: EventAccess) {
    const { budgetLinks, checklistLinks, ...rest } = item
    const showBudget = !access || this.access.canSee(access, EventSurface.BUDGET)
    const showChecklist = !access || this.access.canSee(access, EventSurface.CHECKLIST)
    return {
      ...rest,
      budgetItems: showBudget ? budgetLinks.map((link) => link.budgetItem) : [],
      checklistItems: showChecklist
        ? checklistLinks
          .filter((link) => !access || this.access.canSeeChecklistRow(access, link.checklistItem.concealments))
          .map((link) => ({
            id: link.checklistItem.id,
            title: link.checklistItem.title,
            isCompleted: link.checklistItem.isCompleted,
          }))
        : [],
    }
  }

  private async assertAssignee(
    eventId: string,
    assigneeUserId: string | null,
    hiddenFromMemberIds?: string[],
    checklistId?: string,
  ) {
    if (!assigneeUserId) return
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
    if (!event) throw new NotFoundException('Event not found')

    const parentHost = event.parentId
      ? Boolean(await this.prisma.event.findFirst({
          where: { id: event.parentId, userId: assigneeUserId, deletedAt: null },
          select: { id: true },
        }))
      : false
    const isHost = event.userId === assigneeUserId || parentHost

    let memberId: string | null = null
    if (!isHost) {
      const direct = await this.prisma.eventMember.findFirst({
        where: {
          eventId,
          userId: assigneeUserId,
          acceptedAt: { not: null },
        },
      })
      if (direct?.surfaces.includes(EventSurface.CHECKLIST)) {
        memberId = direct.id
      } else if (event.parentId) {
        const parentMember = await this.prisma.eventMember.findFirst({
          where: {
            eventId: event.parentId,
            userId: assigneeUserId,
            acceptedAt: { not: null },
          },
        })
        const grant = parentMember
          ? await this.prisma.eventSubGrant.findUnique({
              where: {
                eventMemberId_eventId: {
                  eventMemberId: parentMember.id,
                  eventId,
                },
              },
            })
          : null
        if (!parentMember || !grant?.surfaces.includes(EventSurface.CHECKLIST)) {
          throw new BadRequestException('Assignee must already have Checklist on this event')
        }
        memberId = parentMember.id
      } else {
        throw new BadRequestException('Assignee must already have Checklist on this event')
      }
    }

    const hidden = new Set(hiddenFromMemberIds ?? [])
    if (checklistId && hiddenFromMemberIds === undefined) {
      const existing = await this.prisma.eventChecklistConcealment.findMany({
        where: { checklistId },
        select: { eventMemberId: true },
      })
      existing.forEach((row) => hidden.add(row.eventMemberId))
    }
    if (memberId && hidden.has(memberId)) {
      throw new BadRequestException('Cannot assign a hidden row to that person')
    }
  }

  private projectEvent<
    T extends {
      totalBudget: number
      budgetItems: unknown[]
      checklist: Array<{
        assigneeUserId?: string | null
        concealments?: { eventMemberId: string }[]
      }>
      schedule: {
        budgetLinks: { budgetItem: { id: string; label: string | null; vendorName: string | null; category: VendorCategory; allocatedAmount: number } }[]
        checklistLinks: { checklistItem: { id: string; title: string; isCompleted: boolean } }[]
      }[]
      inquiries?: unknown[]
      createdAt: Date
      updatedAt?: Date
      id: string
    },
  >(event: T, access: EventAccess, assignedToMe = false) {
    const showBudget = this.access.canSee(access, EventSurface.BUDGET)
    const showChecklist = this.access.canSee(access, EventSurface.CHECKLIST)
    const showSchedule = this.access.canSee(access, EventSurface.SCHEDULE)
    const showVendors = this.access.canSee(access, EventSurface.VENDORS)
    let checklist = showChecklist
      ? event.checklist.filter((row) => this.access.canSeeChecklistRow(access, row.concealments))
      : []
    if (assignedToMe) {
      checklist = checklist.filter((row) => row.assigneeUserId === access.user.id)
    }
    const projectedChecklist = checklist.map((row) => {
      const { concealments, ...rest } = row
      return {
        ...rest,
        hiddenFromMemberIds: access.isHost ? (concealments ?? []).map((c) => c.eventMemberId) : [],
      }
    })
    return {
      ...event,
      totalBudget: showBudget ? event.totalBudget : 0,
      budgetItems: showBudget ? rewriteReceiptUrls(event.id, event.budgetItems as { id: string; receipts?: { id: string; url: string }[] }[]) : [],
      checklist: projectedChecklist,
      schedule: showSchedule
        ? event.schedule.map((item) => this.toScheduleDto(item, access))
        : [],
      ...(event.inquiries !== undefined ? { inquiries: showVendors ? event.inquiries : [] } : {}),
      viewer: viewerDto(access),
    }
  }

  private assertLinkSurfaces(
    access: EventAccess,
    budgetItemIds: string[],
    checklistItemIds: string[],
    inspirationItemIds: string[] = [],
  ) {
    if (budgetItemIds.length > 0 && !this.access.canSee(access, EventSurface.BUDGET)) {
      throw new NotFoundException('Event not found')
    }
    if (checklistItemIds.length > 0 && !this.access.canSee(access, EventSurface.CHECKLIST)) {
      throw new NotFoundException('Event not found')
    }
    if (inspirationItemIds.length > 0 && !this.access.canSee(access, EventSurface.MOODBOARD)) {
      throw new NotFoundException('Event not found')
    }
  }

  private async assertLinkedItems(
    access: EventAccess,
    eventId: string,
    budgetItemIds: string[],
    checklistItemIds: string[],
  ) {
    if (budgetItemIds.length > 0) {
      const count = await this.prisma.eventBudgetItem.count({
        where: { eventId, id: { in: budgetItemIds } },
      })
      if (count !== budgetItemIds.length) {
        throw new NotFoundException('Budget item not found on this event')
      }
    }
    if (checklistItemIds.length > 0) {
      const count = await this.prisma.eventChecklist.count({
        where: { eventId, id: { in: checklistItemIds } },
      })
      if (count !== checklistItemIds.length) {
        throw new NotFoundException('Checklist item not found on this event')
      }
      const visible = await this.access.filterVisibleChecklistIds(access, checklistItemIds)
      if (visible.size !== checklistItemIds.length) {
        throw new NotFoundException('Checklist item not found on this event')
      }
    }
  }

  private async syncScheduleInspirations(
    eventId: string,
    scheduleItemId: string,
    inspirationItemIds: string[],
  ) {
    const ids = this.uniqueIds(inspirationItemIds)
    const moodItems = ids.length === 0
      ? []
      : await this.prisma.moodBoardItem.findMany({
        where: { eventId, inspirationItemId: { in: ids } },
        select: { id: true },
      })
    if (moodItems.length !== ids.length) {
      throw new NotFoundException('Inspiration is not saved to this event')
    }

    await this.prisma.eventScheduleMoodBoardLink.deleteMany({
      where: { scheduleItemId },
    })
    if (moodItems.length > 0) {
      await this.prisma.eventScheduleMoodBoardLink.createMany({
        data: moodItems.map((item) => ({
          scheduleItemId,
          moodBoardItemId: item.id,
        })),
      })
    }
  }

  async listSchedule(clerkId: string, eventId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.SCHEDULE, action: 'view' })

    return this.prisma.eventScheduleItem.findMany({
      where: { eventId },
      orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, title: true, date: true, startTime: true, endTime: true },
    })
  }

  async addScheduleItem(clerkId: string, eventId: string, dto: CreateScheduleItemDto) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.SCHEDULE, action: 'edit' })

    const budgetItemIds = this.uniqueIds(dto.budgetItemIds)
    const checklistItemIds = this.uniqueIds(dto.checklistItemIds)
    this.assertLinkSurfaces(access, budgetItemIds, checklistItemIds, dto.inspirationItemIds ?? [])
    await this.assertLinkedItems(access, eventId, budgetItemIds, checklistItemIds)

    const date = this.resolveScheduleDate(access.event, dto.date, { required: true })

    const last = await this.prisma.eventScheduleItem.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
    })

    const created = await this.prisma.eventScheduleItem.create({
      data: {
        eventId,
        title: dto.title.trim(),
        notes: this.emptyToNull(dto.notes),
        date,
        startTime: this.normalizeTime(dto.startTime),
        endTime: this.normalizeTime(dto.endTime),
        location: this.emptyToNull(dto.location),
        sortOrder: (last?.sortOrder ?? 0) + 1,
        budgetLinks: {
          create: budgetItemIds.map((budgetItemId) => ({ budgetItemId })),
        },
        checklistLinks: {
          create: checklistItemIds.map((checklistItemId) => ({ checklistItemId })),
        },
      },
      include: SCHEDULE_INCLUDE,
    })
    await this.syncScheduleInspirations(eventId, created.id, dto.inspirationItemIds ?? [])
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.CREATED,
      EventSurface.SCHEDULE,
      `Added schedule block “${created.title}”`,
      'SCHEDULE_ITEM',
      created.id,
    )
    return this.toScheduleDto(created, access)
  }

  async updateScheduleItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateScheduleItemDto,
  ) {
    const access = await this.access.require(clerkId, eventId, { surface: EventSurface.SCHEDULE, action: 'edit' })

    const existing = await this.prisma.eventScheduleItem.findFirst({
      where: { id: itemId, eventId },
    })
    if (!existing) throw new NotFoundException('Schedule item not found')

    const budgetItemIds = dto.budgetItemIds === undefined ? undefined : this.uniqueIds(dto.budgetItemIds)
    const checklistItemIds = dto.checklistItemIds === undefined ? undefined : this.uniqueIds(dto.checklistItemIds)
    this.assertLinkSurfaces(
      access,
      budgetItemIds ?? [],
      checklistItemIds ?? [],
      dto.inspirationItemIds ?? [],
    )
    await this.assertLinkedItems(access, eventId, budgetItemIds ?? [], checklistItemIds ?? [])

    if (dto.date !== undefined) {
      this.resolveScheduleDate(access.event, dto.date, { required: true })
    }

    const updated = await this.prisma.eventScheduleItem.update({
      where: { id: itemId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.notes !== undefined && { notes: this.emptyToNull(dto.notes) }),
        ...(dto.date !== undefined && { date: this.normalizeDate(dto.date) }),
        ...(dto.startTime !== undefined && { startTime: this.normalizeTime(dto.startTime) }),
        ...(dto.endTime !== undefined && { endTime: this.normalizeTime(dto.endTime) }),
        ...(dto.location !== undefined && { location: this.emptyToNull(dto.location) }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(budgetItemIds !== undefined && {
          budgetLinks: {
            deleteMany: {},
            create: budgetItemIds.map((budgetItemId) => ({ budgetItemId })),
          },
        }),
        ...(checklistItemIds !== undefined && {
          checklistLinks: {
            deleteMany: {},
            create: checklistItemIds.map((checklistItemId) => ({ checklistItemId })),
          },
        }),
      },
      include: SCHEDULE_INCLUDE,
    })
    if (dto.inspirationItemIds !== undefined) {
      await this.syncScheduleInspirations(eventId, itemId, dto.inspirationItemIds)
    }
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      EventSurface.SCHEDULE,
      `Updated schedule block “${updated.title}”`,
      'SCHEDULE_ITEM',
      updated.id,
    )
    return this.toScheduleDto(updated, access)
  }

  async deleteScheduleItem(clerkId: string, eventId: string, itemId: string) {
    const { user } = await this.access.require(clerkId, eventId, { surface: EventSurface.SCHEDULE, action: 'edit' })

    const existing = await this.prisma.eventScheduleItem.findFirst({
      where: { id: itemId, eventId },
    })
    if (!existing) throw new NotFoundException('Schedule item not found')

    const deleted = await this.prisma.eventScheduleItem.delete({ where: { id: itemId } })
    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      EventSurface.SCHEDULE,
      `Removed schedule block “${existing.title}”`,
      'SCHEDULE_ITEM',
      itemId,
    )
    return deleted
  }

  private getDefaultChecklist(tribes: string[]) {
    const common = [
      { title: 'Set your total budget', sortOrder: 1 },
      { title: 'Choose and book your venue', sortOrder: 2 },
      { title: 'Book a caterer', sortOrder: 3 },
      { title: 'Book a photographer', sortOrder: 4 },
      { title: 'Book a videographer', sortOrder: 5 },
      { title: 'Book a DJ or live band', sortOrder: 6 },
      { title: 'Book a decorator', sortOrder: 7 },
      { title: 'Arrange event fabric / aso-ebi', sortOrder: 8 },
      { title: 'Book makeup artist', sortOrder: 9 },
      { title: 'Book an MC/compere', sortOrder: 10 },
      { title: 'Send invitations', sortOrder: 11 },
      { title: 'Arrange transportation', sortOrder: 12 },
      { title: 'Plan rehearsal', sortOrder: 13 },
    ]

    const tribeSpecific: Record<string, { title: string }[]> = {
      YORUBA: [
        { title: 'Source aso-oke and gele fabric for bride and mother' },
        { title: 'Plan alaga iduro and alaga ijoko (ceremony hosts)' },
        { title: 'Arrange palm wine for kneeling ceremony' },
        { title: 'Coordinate aso-ebi fabric for guests' },
      ],
      IGBO: [
        { title: 'Prepare oji (kola nut) for ceremony' },
        { title: 'Source george wrapper and lace fabric' },
        { title: 'Plan wine-carrying ceremony (bride finds groom)' },
        { title: 'Arrange list of items for bride price (ikpo onu)' },
      ],
      HAUSA: [
        { title: 'Plan lefe (pre-wedding gift exchange)' },
        { title: 'Arrange henna night (lalle)' },
        { title: 'Source atamfa and guinea brocade fabric' },
        { title: 'Coordinate waka music and performers' },
      ],
      IBIBIO: [
        { title: 'Source ukod inyanga (traditional bridal attire)' },
        { title: 'Plan nkuho ceremony (bride farewell by family)' },
        { title: 'Arrange usong owo (gifts and dowry presentation)' },
        { title: 'Source ofong fabric and coral beads' },
        { title: 'Coordinate traditional Ibibio music and ekpri nkuho' },
      ],
      EFIK: [
        { title: 'Source mbuoñ (traditional wrapper) and coral beads' },
        { title: 'Plan mbopo (coming-out ceremony) if applicable' },
        { title: 'Arrange bride price list (items and drinks)' },
        { title: 'Coordinate nkwa Efik music and performers' },
      ],
      IJAW: [
        { title: 'Source traditional Ijaw wrapper and hat' },
        { title: 'Arrange ekine masquerade if appropriate' },
        { title: 'Plan dowry ceremony (perebo)' },
        { title: 'Coordinate Ijaw cultural music performers' },
      ],
      URHOBO: [
        { title: 'Source ufuoma traditional attire' },
        { title: 'Plan ighele bride price negotiation' },
        { title: 'Arrange Urhobo cultural dance troupe' },
        { title: 'Source aso-ebi in Urhobo colours' },
      ],
      BINI: [
        { title: 'Source Bini traditional attire (coral beads and wrapper)' },
        { title: 'Plan isi traditional marriage rites' },
        { title: 'Arrange Bini royal music and performers' },
        { title: 'Coordinate ogiamen ceremony elements' },
      ],
      FULANI: [
        { title: 'Plan shadi (Fulani wedding celebration)' },
        { title: 'Arrange wurooji (bride gifts and dowry)' },
        { title: 'Source woven Fulani fabric and traditional dress' },
        { title: 'Coordinate ruga music and griot performers' },
      ],
      TIVI: [
        { title: 'Source gende (handwoven Tiv cloth) for bridal party' },
        { title: 'Plan swange dance performance' },
        { title: 'Arrange bride price (kuchichun) ceremony' },
        { title: 'Coordinate Tiv cultural performers' },
      ],
    }

    // Merge items from all selected tribes, re-number sortOrder after common items
    const seen = new Set<string>()
    const cultural: { title: string; sortOrder: number }[] = []
    let order = common.length + 1

    for (const tribe of tribes) {
      for (const item of tribeSpecific[tribe] ?? []) {
        if (!seen.has(item.title)) {
          seen.add(item.title)
          cultural.push({ title: item.title, sortOrder: order++ })
        }
      }
    }

    return [...common, ...cultural]
  }
}
