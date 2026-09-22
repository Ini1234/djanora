import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { EventActivityAction, EventSurface, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { SseService, type SsePayload } from '../sse/sse.service'
import { EventAccessService, ALL_SURFACES } from './event-access.service'
import { applyUnreadRows, emptyUnreadCounts } from './unread-counts'

export const OVERVIEW_SURFACE = 'OVERVIEW'
export const OPENED_SURFACE = 'OPENED'

export function unreadSurfaceKey(surface: EventSurface | null): string {
  return surface ?? OVERVIEW_SURFACE
}

const ACTOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
} as const

export type ActivityLogInput = {
  eventId: string
  actorId: string
  action: EventActivityAction
  surface: EventSurface | null
  summary: string
  subjectType?: string
  subjectId?: string
}

@Injectable()
export class EventActivityService {
  private readonly logger = new Logger(EventActivityService.name)

  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private sse: SseService,
  ) {}

  unreadKey(surface: EventSurface | null): string {
    return unreadSurfaceKey(surface)
  }

  async log(input: ActivityLogInput) {
    try {
      const row = await this.prisma.eventActivity.create({
        data: {
          eventId: input.eventId,
          actorId: input.actorId,
          action: input.action,
          surface: input.surface,
          summary: input.summary,
          subjectType: input.subjectType ?? null,
          subjectId: input.subjectId ?? null,
        },
        include: { actor: { select: ACTOR_SELECT } },
      })

      const payload: SsePayload = {
        type: 'event_activity',
        eventId: input.eventId,
        activity: {
          id: row.id,
          eventId: row.eventId,
          action: row.action,
          surface: this.unreadKey(row.surface),
          summary: row.summary,
          subjectType: row.subjectType,
          subjectId: row.subjectId,
          createdAt: row.createdAt,
          actor: row.actor,
        },
      }
      await this.emitToEvent(input.eventId, input.surface, payload, input.actorId)
      void this.touchEvent(input.eventId)
      return row
    } catch (err) {
      this.logger.warn(
        `Failed to write event activity for ${input.eventId}: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return null
    }
  }

  async touchEvent(eventId: string) {
    await this.prisma.event
      .update({
        where: { id: eventId },
        data: { updatedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to touch event ${eventId}: ${err instanceof Error ? err.message : 'unknown'}`,
        )
      })
  }

  async recordOpen(userId: string, eventId: string) {
    const now = new Date()
    await this.prisma.eventSurfaceRead
      .upsert({
        where: {
          eventId_userId_surface: { eventId, userId, surface: OPENED_SURFACE },
        },
        create: { eventId, userId, surface: OPENED_SURFACE, seenAt: now },
        update: { seenAt: now },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to record event open ${eventId}: ${err instanceof Error ? err.message : 'unknown'}`,
        )
      })
  }

  async list(clerkId: string, eventId: string, opts: { limit?: number; cursor?: string } = {}) {
    const access = await this.access.require(clerkId, eventId)
    const visible = access.isHost ? ALL_SURFACES : access.surfaces
    const limit = Number.isFinite(opts.limit)
      ? Math.min(Math.max(Math.trunc(opts.limit!), 1), 50)
      : 20
    const cursor = opts.cursor?.trim() || undefined

    const rows = await this.prisma.eventActivity
      .findMany({
        where: {
          eventId,
          OR: [{ surface: null }, { surface: { in: visible } }],
        },
        include: { actor: { select: ACTOR_SELECT } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new BadRequestException('Invalid cursor')
        }
        throw err
      })

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows

    const visibleChecklistIds = await this.access.filterVisibleChecklistIds(
      access,
      page
        .filter((row) => row.subjectType === 'CHECKLIST_ITEM' && row.subjectId)
        .map((row) => row.subjectId!),
    )

    const items = page
      .filter(
        (row) =>
          row.subjectType !== 'CHECKLIST_ITEM' ||
          !row.subjectId ||
          visibleChecklistIds.has(row.subjectId),
      )
      .map((row) => ({
        id: row.id,
        action: row.action,
        surface: this.unreadKey(row.surface),
        summary: row.summary,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        createdAt: row.createdAt,
        actor: row.actor,
      }))

    return {
      items,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    }
  }

  async unreadCounts(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId)
    const visible = access.isHost ? ALL_SURFACES : access.surfaces
    const keys = [OVERVIEW_SURFACE, ...visible]
    const counts = emptyUnreadCounts(keys)

    const surfaceFilter =
      visible.length === 0
        ? Prisma.sql`AND a.surface IS NULL`
        : Prisma.sql`AND (a.surface IS NULL OR a.surface IN (${Prisma.join(visible)}))`

    const concealFilter =
      access.isHost || !access.memberId
        ? Prisma.sql``
        : Prisma.sql`AND (
            a.subject_type IS DISTINCT FROM 'CHECKLIST_ITEM'
            OR a.subject_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM event_checklist_concealments c
              WHERE c.checklist_id = a.subject_id
                AND c.event_member_id = ${access.memberId}
            )
          )`

    const rows = await this.prisma.$queryRaw<Array<{ key: string; count: number }>>(Prisma.sql`
      SELECT COALESCE(a.surface::text, ${OVERVIEW_SURFACE}) AS key, COUNT(*)::int AS count
      FROM event_activities a
      LEFT JOIN event_surface_reads r
        ON r.event_id = a.event_id
       AND r.user_id = ${access.user.id}
       AND r.surface = COALESCE(a.surface::text, ${OVERVIEW_SURFACE})
      WHERE a.event_id = ${eventId}
        AND a.actor_id <> ${access.user.id}
        ${surfaceFilter}
        AND (r.seen_at IS NULL OR a.created_at > r.seen_at)
        ${concealFilter}
      GROUP BY 1
    `)

    return applyUnreadRows(counts, rows)
  }

  async markSeen(clerkId: string, eventId: string, surface: string) {
    const access = await this.access.require(clerkId, eventId)
    const allowed =
      surface === OVERVIEW_SURFACE ||
      access.isHost ||
      access.surfaces.includes(surface as EventSurface)
    if (!allowed) throw new NotFoundException('Event not found')

    await this.prisma.eventSurfaceRead.upsert({
      where: {
        eventId_userId_surface: {
          eventId,
          userId: access.user.id,
          surface,
        },
      },
      create: {
        eventId,
        userId: access.user.id,
        surface,
        seenAt: new Date(),
      },
      update: { seenAt: new Date() },
    })
    return { surface, seen: true }
  }

  async emitComment(
    eventId: string,
    surface: EventSurface | null,
    payload: SsePayload,
    exceptUserId?: string,
  ) {
    await this.emitToEvent(eventId, surface, payload, exceptUserId)
  }

  private async emitToEvent(
    eventId: string,
    surface: EventSurface | null,
    payload: SsePayload,
    exceptUserId?: string,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { userId: true },
    })
    if (!event) return

    const members = await this.prisma.eventMember.findMany({
      where: { eventId, acceptedAt: { not: null }, userId: { not: null } },
      select: { userId: true, surfaces: true },
    })

    const ids = new Set<string>()
    if (event.userId !== exceptUserId) ids.add(event.userId)
    for (const m of members) {
      if (!m.userId || m.userId === exceptUserId) continue
      if (surface && !m.surfaces.includes(surface)) continue
      ids.add(m.userId)
    }
    for (const userId of ids) this.sse.emit(userId, payload)
  }
}
