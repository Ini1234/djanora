import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { EventSurface, UserRole, Tribe } from '@prisma/client'
import { ALL_SURFACES, EventAccessService } from '../events/event-access.service'

interface UpsertUserDto {
  clerkId: string
  email: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private access: EventAccessService,
  ) {}

  async upsert(dto: UpsertUserDto) {
    const user = await this.prisma.user.upsert({
      where: { clerkId: dto.clerkId },
      create: {
        clerkId: dto.clerkId,
        email: dto.email,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        role: UserRole.USER,
      },
      update: {
        email: dto.email,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        avatarUrl: dto.avatarUrl ?? null,
      },
    })

    this.logger.log(`Upserted user ${user.id} (clerkId: ${dto.clerkId})`)
    return user
  }

  async softDelete(clerkId: string) {
    const user = await this.prisma.user.update({
      where: { clerkId },
      data: { deletedAt: new Date() },
    })

    this.logger.log(`Soft deleted user ${user.id} (clerkId: ${clerkId})`)
    return user
  }

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: true },
    })
  }

  /**
   * Return the local user, creating them from Clerk if the webhook missed
   * (Nest/DB was down at sign-up). Same shape as findByClerkId.
   */
  async ensureFromClerk(clerkId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: true },
    })
    if (existing) return existing

    const clerk = createClerkClient({
      secretKey: this.config.get<string>('CLERK_SECRET_KEY'),
    })
    const clerkUser = await clerk.users.getUser(clerkId)
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

    if (!email) {
      throw new BadRequestException('Could not resolve email for new user from Clerk')
    }

    this.logger.warn(`Webhook hadn't fired for ${clerkId} — creating user inline`)

    // upsert: webhook can land in the same moment
    await this.prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        avatarUrl: clerkUser.imageUrl ?? null,
        role: UserRole.USER,
      },
      update: {},
    })

    return this.prisma.user.findUniqueOrThrow({
      where: { clerkId },
      include: { vendorProfile: true },
    })
  }

  async updateMe(
    clerkId: string,
    data: {
      firstName?: string
      lastName?: string
      phone?: string
      city?: string
    },
  ) {
    return this.prisma.user.update({
      where: { clerkId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
        ...(data.lastName !== undefined && { lastName: data.lastName.trim() || null }),
        ...(data.phone !== undefined && { phone: data.phone.trim() || null }),
        ...(data.city !== undefined && { city: data.city.trim() || null }),
      },
    })
  }

  async setMode(clerkId: string, mode: 'user' | 'vendor') {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, hasVendorProfile: true },
    })
    if (!user) throw new NotFoundException('User not found')
    if (mode === 'vendor' && !user.hasVendorProfile) {
      throw new BadRequestException('Create a vendor profile first')
    }
    return this.prisma.user.update({
      where: { clerkId },
      data: { activeMode: mode },
    })
  }

  async completeOnboarding(
    clerkId: string,
    data: {
      firstName?: string
      lastName?: string
      role: 'USER' | 'VENDOR'
      tribes?: string[]
      city?: string
      countryOfOrigin?: string
      dateOfBirth?: string
    },
  ) {
    if (data.role !== 'USER' && data.role !== 'VENDOR') {
      throw new BadRequestException('Invalid role')
    }

    const profileData = {
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as UserRole,
      hasVendorProfile: data.role === 'VENDOR',
      tribes: (data.tribes ?? []) as Tribe[],
      city: data.city,
      countryOfOrigin: data.countryOfOrigin,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      onboardingCompletedAt: new Date(),
    }

    await this.ensureFromClerk(clerkId)
    return this.prisma.user.update({ where: { clerkId }, data: profileData })
  }

  private async requireUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true, email: true },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  private async canSyncEventChecklist(clerkId: string, eventId: string, checklistId: string) {
    try {
      const access = await this.access.load(clerkId, eventId)
      return this.access.canSeeChecklistItem(access, checklistId)
    } catch {
      return false
    }
  }

  private projectChecklist(row: {
    id: string
    title: string
    isCompleted: boolean
    dueDate: Date | null
    eventId: string | null
    eventChecklistId: string | null
    createdAt: Date
    updatedAt: Date
    event: { id: string; title: string } | null
  }) {
    return {
      id: row.id,
      title: row.title,
      isCompleted: row.isCompleted,
      dueDate: row.dueDate?.toISOString() ?? null,
      eventId: row.eventId,
      eventChecklistId: row.eventChecklistId,
      event: row.event,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private pageLimit(limit: number | undefined, fallback: number) {
    if (!Number.isFinite(limit)) return fallback
    return Math.min(Math.max(Math.trunc(limit!), 1), 50)
  }

  private paginateChecklist<T extends { id: string }>(items: T[], limit: number, cursor?: string) {
    let start = 0
    if (cursor) {
      const idx = items.findIndex((item) => item.id === cursor)
      if (idx === -1) throw new BadRequestException('Invalid cursor')
      start = idx + 1
    }
    const slice = items.slice(start, start + limit + 1)
    const hasMore = slice.length > limit
    const page = hasMore ? slice.slice(0, limit) : slice
    return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null }
  }

  private compareDue(
    a: { dueDate: string | null; isCompleted?: boolean; id: string },
    b: { dueDate: string | null; isCompleted?: boolean; id: string },
  ) {
    if (Boolean(a.isCompleted) !== Boolean(b.isCompleted)) return a.isCompleted ? 1 : -1
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    return a.id.localeCompare(b.id)
  }

  private async visibleAssigned(clerkId: string, userId: string, linked: Set<string>) {
    const assigned = await this.prisma.eventChecklist.findMany({
      where: {
        assigneeUserId: userId,
        ...(linked.size ? { id: { notIn: [...linked] } } : {}),
        event: { deletedAt: null },
      },
      include: {
        event: { select: { id: true, title: true } },
        concealments: { select: { eventMemberId: true } },
      },
    })

    const visible: Array<
      ReturnType<UsersService['projectChecklist']> & {
        assigneeUserId: string
        source: 'ASSIGNED'
      }
    > = []
    for (const row of assigned) {
      let canSee = false
      try {
        const access = await this.access.load(clerkId, row.eventId)
        canSee =
          this.access.canSee(access, EventSurface.CHECKLIST) &&
          this.access.canSeeChecklistRow(access, row.concealments)
      } catch {
        canSee = false
      }
      if (!canSee) continue
      visible.push({
        id: row.id,
        title: row.title,
        isCompleted: row.isCompleted,
        dueDate: row.dueDate?.toISOString() ?? null,
        eventId: row.eventId,
        eventChecklistId: row.id,
        event: { id: row.event.id, title: row.event.title },
        assigneeUserId: userId,
        source: 'ASSIGNED' as const,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })
    }
    return visible
  }

  private async visibleDueEventItems(user: { id: string; email: string }, hideIds: Set<string>) {
    const [hosted, memberships, grants] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId: user.id, deletedAt: null },
        select: { id: true, title: true },
      }),
      this.prisma.eventMember.findMany({
        where: { userId: user.id, acceptedAt: { not: null }, event: { deletedAt: null } },
        select: {
          id: true,
          eventId: true,
          surfaces: true,
          event: { select: { id: true, title: true } },
        },
      }),
      this.prisma.eventSubGrant.findMany({
        where: {
          member: {
            acceptedAt: { not: null },
            OR: [{ userId: user.id }, { email: { equals: user.email, mode: 'insensitive' } }],
            event: { deletedAt: null },
          },
          event: { deletedAt: null },
        },
        select: {
          eventId: true,
          surfaces: true,
          event: { select: { id: true, title: true } },
          member: { select: { id: true } },
        },
      }),
    ])

    const accessByEvent = new Map<
      string,
      { title: string; isHost: boolean; memberId?: string; surfaces: EventSurface[] }
    >()
    for (const event of hosted) {
      accessByEvent.set(event.id, { title: event.title, isHost: true, surfaces: ALL_SURFACES })
    }
    for (const member of memberships) {
      if (accessByEvent.has(member.eventId)) continue
      accessByEvent.set(member.eventId, {
        title: member.event.title,
        isHost: false,
        memberId: member.id,
        surfaces: member.surfaces,
      })
    }
    for (const grant of grants) {
      if (accessByEvent.has(grant.eventId)) continue
      accessByEvent.set(grant.eventId, {
        title: grant.event.title,
        isHost: false,
        memberId: grant.member.id,
        surfaces: grant.surfaces,
      })
    }

    const eventIds = [...accessByEvent.entries()]
      .filter(([, access]) => access.isHost || access.surfaces.includes(EventSurface.CHECKLIST))
      .map(([id]) => id)
    if (eventIds.length === 0) return []

    const rows = await this.prisma.eventChecklist.findMany({
      where: {
        eventId: { in: eventIds },
        isCompleted: false,
        dueDate: { not: null },
        ...(hideIds.size ? { id: { notIn: [...hideIds] } } : {}),
      },
      include: {
        event: { select: { id: true, title: true } },
        concealments: { select: { eventMemberId: true } },
      },
    })

    return rows.flatMap((row) => {
      const access = accessByEvent.get(row.eventId)
      if (!access) return []
      if (
        !access.isHost &&
        access.memberId &&
        row.concealments.some((conceal) => conceal.eventMemberId === access.memberId)
      ) {
        return []
      }
      const assigned = row.assigneeUserId === user.id
      return [
        {
          id: row.id,
          title: row.title,
          isCompleted: row.isCompleted,
          dueDate: row.dueDate?.toISOString() ?? null,
          eventId: row.eventId,
          eventChecklistId: row.id,
          event: { id: row.event.id, title: row.event.title },
          assigneeUserId: row.assigneeUserId ?? undefined,
          source: assigned ? ('ASSIGNED' as const) : ('EVENT' as const),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      ]
    })
  }

  async listDueChecklists(clerkId: string, opts: { limit?: number; cursor?: string } = {}) {
    const user = await this.requireUser(clerkId)
    const limit = this.pageLimit(opts.limit, 8)

    const rows = await this.prisma.userChecklist.findMany({
      where: {
        userId: user.id,
        isCompleted: false,
        dueDate: { not: null },
      },
      include: { event: { select: { id: true, title: true } } },
    })
    const mine = rows.map((row) => ({ ...this.projectChecklist(row), source: 'MINE' as const }))
    const hideIds = new Set(
      [
        ...rows.map((row) => row.eventChecklistId),
        ...(
          await this.prisma.userChecklist.findMany({
            where: { userId: user.id, isCompleted: true, eventChecklistId: { not: null } },
            select: { eventChecklistId: true },
          })
        ).map((row) => row.eventChecklistId),
      ].filter((id): id is string => !!id),
    )

    const eventItems = await this.visibleDueEventItems(user, hideIds)
    const items = [...mine, ...eventItems].sort((a, b) => this.compareDue(a, b))
    return this.paginateChecklist(items, limit, opts.cursor)
  }

  async listChecklists(clerkId: string, opts: { limit?: number; cursor?: string } = {}) {
    const user = await this.requireUser(clerkId)
    const limit = this.pageLimit(opts.limit, 20)
    const rows = await this.prisma.userChecklist.findMany({
      where: { userId: user.id },
      include: { event: { select: { id: true, title: true } } },
    })
    const mine = rows.map((row) => ({ ...this.projectChecklist(row), source: 'MINE' as const }))
    const linked = new Set(rows.map((row) => row.eventChecklistId).filter(Boolean) as string[])
    const assigned = await this.visibleAssigned(clerkId, user.id, linked)
    const items = [...mine, ...assigned].sort((a, b) => this.compareDue(a, b))
    return this.paginateChecklist(items, limit, opts.cursor)
  }

  async createChecklist(
    clerkId: string,
    dto: { title: string; dueDate: string; eventId?: string | null },
  ) {
    const user = await this.requireUser(clerkId)
    const eventId = dto.eventId?.trim() || null
    if (eventId) {
      await this.access.require(clerkId, eventId, {
        surface: EventSurface.CHECKLIST,
        action: 'edit',
      })
    }

    const title = dto.title.trim()
    const dueDate = new Date(dto.dueDate)

    const created = await this.prisma.$transaction(async (tx) => {
      let eventChecklistId: string | null = null
      if (eventId) {
        const last = await tx.eventChecklist.findFirst({
          where: { eventId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        })
        const eventItem = await tx.eventChecklist.create({
          data: {
            eventId,
            title,
            dueDate,
            sortOrder: (last?.sortOrder ?? 0) + 1,
          },
        })
        eventChecklistId = eventItem.id
      }

      return tx.userChecklist.create({
        data: {
          userId: user.id,
          title,
          dueDate,
          eventId,
          eventChecklistId,
        },
        include: { event: { select: { id: true, title: true } } },
      })
    })

    return this.projectChecklist(created)
  }

  async updateChecklist(
    clerkId: string,
    checklistId: string,
    dto: {
      title?: string
      isCompleted?: boolean
      dueDate?: string | null
      eventId?: string | null
    },
  ) {
    const user = await this.requireUser(clerkId)
    const existing = await this.prisma.userChecklist.findFirst({
      where: { id: checklistId, userId: user.id },
    })
    if (!existing) throw new NotFoundException('Checklist not found')

    const nextEventId = dto.eventId === undefined ? existing.eventId : dto.eventId?.trim() || null
    if (nextEventId && nextEventId !== existing.eventId) {
      await this.access.require(clerkId, nextEventId, {
        surface: EventSurface.CHECKLIST,
        action: 'edit',
      })
    }

    const title = dto.title !== undefined ? dto.title.trim() : existing.title
    const dueDate =
      dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : existing.dueDate
    const isCompleted = dto.isCompleted !== undefined ? dto.isCompleted : existing.isCompleted

    const updated = await this.prisma.$transaction(async (tx) => {
      let eventChecklistId = existing.eventChecklistId

      if (nextEventId !== existing.eventId) {
        if (existing.eventChecklistId) {
          await tx.userChecklist.update({
            where: { id: checklistId },
            data: { eventChecklistId: null },
          })
          await tx.eventChecklist.deleteMany({ where: { id: existing.eventChecklistId } })
          eventChecklistId = null
        }
        if (nextEventId) {
          const last = await tx.eventChecklist.findFirst({
            where: { eventId: nextEventId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
          })
          const eventItem = await tx.eventChecklist.create({
            data: {
              eventId: nextEventId,
              title,
              dueDate,
              isCompleted,
              sortOrder: (last?.sortOrder ?? 0) + 1,
            },
          })
          eventChecklistId = eventItem.id
        }
      } else if (eventChecklistId && existing.eventId) {
        const canSync = await this.canSyncEventChecklist(
          clerkId,
          existing.eventId,
          eventChecklistId,
        )
        if (canSync) {
          await tx.eventChecklist.update({
            where: { id: eventChecklistId },
            data: { title, dueDate, isCompleted, notifiedAt: null },
          })
        }
      }

      return tx.userChecklist.update({
        where: { id: checklistId },
        data: { title, dueDate, isCompleted, eventId: nextEventId, eventChecklistId },
        include: { event: { select: { id: true, title: true } } },
      })
    })

    return this.projectChecklist(updated)
  }

  async deleteChecklist(clerkId: string, checklistId: string) {
    const user = await this.requireUser(clerkId)
    const existing = await this.prisma.userChecklist.findFirst({
      where: { id: checklistId, userId: user.id },
    })
    if (!existing) throw new NotFoundException('Checklist not found')

    await this.prisma.$transaction(async (tx) => {
      await tx.userChecklist.delete({ where: { id: checklistId } })
      if (existing.eventChecklistId) {
        await tx.eventChecklist.deleteMany({ where: { id: existing.eventChecklistId } })
      }
    })
    return { ok: true }
  }
}
