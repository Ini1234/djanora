import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import {
  EventMemberRole,
  EventSurface,
  type Event,
  type User,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const ALL_SURFACES: EventSurface[] = [
  EventSurface.SCHEDULE,
  EventSurface.CHECKLIST,
  EventSurface.BUDGET,
  EventSurface.MOODBOARD,
  EventSurface.VENDORS,
  EventSurface.GUESTS,
]

export type AccessAction = 'view' | 'comment' | 'edit' | 'host'

export type EventAccess = {
  user: User
  event: Event
  isHost: boolean
  role: 'HOST' | EventMemberRole
  surfaces: EventSurface[]
  memberId?: string
}

type AccessPrincipal = Pick<EventAccess, 'isHost' | 'role' | 'surfaces'>

export function viewerDto(access: EventAccess) {
  return {
    isHost: access.isHost,
    role: access.role,
    surfaces: access.surfaces,
    memberId: access.memberId ?? null,
    userId: access.user.id,
  }
}

export function roleAllowsEdit(access: Pick<AccessPrincipal, 'isHost' | 'role'>): boolean {
  return access.isHost || access.role === EventMemberRole.EDITOR
}

export function roleAllowsComment(access: Pick<AccessPrincipal, 'isHost' | 'role'>): boolean {
  return (
    access.isHost
    || access.role === EventMemberRole.EDITOR
    || access.role === EventMemberRole.COMMENTER
  )
}

export function memberCanSee(access: AccessPrincipal, surface: EventSurface): boolean {
  if (access.isHost) return true
  return access.surfaces.includes(surface)
}

export function memberCanEdit(access: AccessPrincipal, surface: EventSurface): boolean {
  return memberCanSee(access, surface) && roleAllowsEdit(access)
}

export function memberCanComment(access: AccessPrincipal, surface: EventSurface): boolean {
  return memberCanSee(access, surface) && roleAllowsComment(access)
}

/** Role is always enforced. Surface is an extra gate when provided. */
export function allowsAction(
  access: AccessPrincipal,
  action: AccessAction,
  surface?: EventSurface,
): boolean {
  if (action === 'host') return access.isHost

  if (action === 'edit') {
    if (!roleAllowsEdit(access)) return false
    return surface ? memberCanEdit(access, surface) : true
  }

  if (action === 'comment') {
    if (!roleAllowsComment(access)) return false
    return surface ? memberCanComment(access, surface) : true
  }

  return surface ? memberCanSee(access, surface) : true
}

function deny(): never {
  throw new NotFoundException('Event not found')
}

@Injectable()
export class EventAccessService {
  constructor(private prisma: PrismaService) {}

  canSee(access: EventAccess, surface: EventSurface): boolean {
    return memberCanSee(access, surface)
  }

  canComment(access: EventAccess, surface: EventSurface): boolean {
    return memberCanComment(access, surface)
  }

  canEdit(access: EventAccess, surface: EventSurface): boolean {
    return memberCanEdit(access, surface)
  }

  canSeeChecklistRow(
    access: EventAccess,
    concealments?: { eventMemberId: string }[],
  ) {
    if (access.isHost || !access.memberId) return true
    return !(concealments ?? []).some((row) => row.eventMemberId === access.memberId)
  }

  async canSeeChecklistItem(access: EventAccess, checklistId: string) {
    const row = await this.prisma.eventChecklist.findFirst({
      where: { id: checklistId, eventId: access.event.id },
      select: { concealments: { select: { eventMemberId: true } } },
    })
    if (!row) return false
    return this.canSeeChecklistRow(access, row.concealments)
  }

  async assertCanSeeChecklistItem(access: EventAccess, checklistId: string) {
    const ok = await this.canSeeChecklistItem(access, checklistId)
    if (!ok) deny()
  }

  async filterVisibleChecklistIds(access: EventAccess, checklistIds: string[]) {
    const unique = [...new Set(checklistIds.filter(Boolean))]
    if (unique.length === 0) return new Set<string>()
    if (access.isHost || !access.memberId) return new Set(unique)
    const rows = await this.prisma.eventChecklist.findMany({
      where: { id: { in: unique }, eventId: access.event.id },
      select: { id: true, concealments: { select: { eventMemberId: true } } },
    })
    return new Set(
      rows.filter((row) => this.canSeeChecklistRow(access, row.concealments)).map((row) => row.id),
    )
  }

  async assertConcealmentTargets(eventId: string, memberIds: string[]) {
    const unique = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))]
    if (unique.length === 0) return
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, parentId: true },
    })
    if (!event) deny()

    const found = new Set(
      (
        await this.prisma.eventMember.findMany({
          where: { eventId, id: { in: unique } },
          select: { id: true },
        })
      ).map((row) => row.id),
    )
    const missing = unique.filter((id) => !found.has(id))
    if (missing.length > 0 && event.parentId) {
      const parentMembers = await this.prisma.eventMember.findMany({
        where: { eventId: event.parentId, id: { in: missing } },
        select: { id: true },
      })
      const grants = await this.prisma.eventSubGrant.findMany({
        where: { eventId, eventMemberId: { in: parentMembers.map((row) => row.id) } },
        select: { eventMemberId: true },
      })
      const granted = new Set(grants.map((row) => row.eventMemberId))
      for (const member of parentMembers) {
        if (granted.has(member.id)) found.add(member.id)
      }
    }
    if (unique.some((id) => !found.has(id))) {
      throw new BadRequestException('Hidden-from member is not on this event')
    }
  }

  async load(clerkId: string, eventId: string): Promise<EventAccess> {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) deny()

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
    if (!event) deny()

    if (event.userId === user.id) {
      return {
        user,
        event,
        isHost: true,
        role: 'HOST',
        surfaces: [...ALL_SURFACES],
      }
    }

    const member = await this.prisma.eventMember.findFirst({
      where: {
        eventId,
        acceptedAt: { not: null },
        OR: [
          { userId: user.id },
          { email: { equals: user.email, mode: 'insensitive' } },
        ],
      },
    })
    if (member) {
      if (!member.userId) {
        await this.prisma.eventMember.update({
          where: { id: member.id },
          data: { userId: user.id },
        })
      }
      return {
        user,
        event,
        isHost: false,
        role: member.role,
        surfaces: member.surfaces,
        memberId: member.id,
      }
    }

    if (event.parentId) {
      const parent = await this.prisma.event.findFirst({
        where: { id: event.parentId, deletedAt: null },
      })
      if (!parent) deny()
      if (parent.userId === user.id) {
        return {
          user,
          event,
          isHost: true,
          role: 'HOST',
          surfaces: [...ALL_SURFACES],
        }
      }

      const parentMember = await this.prisma.eventMember.findFirst({
        where: {
          eventId: event.parentId,
          acceptedAt: { not: null },
          OR: [
            { userId: user.id },
            { email: { equals: user.email, mode: 'insensitive' } },
          ],
        },
      })
      if (!parentMember) deny()

      const grant = await this.prisma.eventSubGrant.findUnique({
        where: {
          eventMemberId_eventId: {
            eventMemberId: parentMember.id,
            eventId,
          },
        },
      })
      if (!grant) deny()

      if (!parentMember.userId) {
        await this.prisma.eventMember.update({
          where: { id: parentMember.id },
          data: { userId: user.id },
        })
      }

      return {
        user,
        event,
        isHost: false,
        role: parentMember.role,
        surfaces: grant.surfaces,
        memberId: parentMember.id,
      }
    }

    deny()
  }

  async require(
    clerkId: string,
    eventId: string,
    opts?: { surface?: EventSurface; action?: AccessAction },
  ): Promise<EventAccess> {
    const access = await this.load(clerkId, eventId)
    const action = opts?.action ?? 'view'
    if (!allowsAction(access, action, opts?.surface)) {
      if (opts?.surface && !memberCanSee(access, opts.surface)) {
        throw new ForbiddenException('You cannot access this tab')
      }
      deny()
    }
    return access
  }

  /** Events this user hosts or has accepted membership on. */
  async listAccessibleEventIds(userId: string): Promise<string[]> {
    const [hosted, memberOf, granted] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.eventMember.findMany({
        where: { userId, acceptedAt: { not: null }, event: { deletedAt: null } },
        select: { eventId: true },
      }),
      this.prisma.eventSubGrant.findMany({
        where: {
          member: {
            acceptedAt: { not: null },
            userId,
            event: { deletedAt: null },
          },
          event: { deletedAt: null },
        },
        select: { eventId: true },
      }),
    ])
    return [...new Set([
      ...hosted.map((e) => e.id),
      ...memberOf.map((m) => m.eventId),
      ...granted.map((g) => g.eventId),
    ])]
  }
}
