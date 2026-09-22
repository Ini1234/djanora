import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventMemberRole, EventSurface, type Event, type User } from '@prisma/client'
import { EventAccessRepository } from './event-access.repository'

export const ALL_SURFACES: EventSurface[] = [
  EventSurface.SCHEDULE,
  EventSurface.CHECKLIST,
  EventSurface.BUDGET,
  EventSurface.MOODBOARD,
  EventSurface.VENDORS,
  EventSurface.GUESTS,
  EventSurface.PARTY,
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
    access.isHost ||
    access.role === EventMemberRole.EDITOR ||
    access.role === EventMemberRole.COMMENTER
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
  constructor(private repo: EventAccessRepository) {}

  canSee(access: EventAccess, surface: EventSurface): boolean {
    return memberCanSee(access, surface)
  }

  canComment(access: EventAccess, surface: EventSurface): boolean {
    return memberCanComment(access, surface)
  }

  canEdit(access: EventAccess, surface: EventSurface): boolean {
    return memberCanEdit(access, surface)
  }

  canSeeChecklistRow(access: EventAccess, concealments?: { eventMemberId: string }[]) {
    if (access.isHost || !access.memberId) return true
    return !(concealments ?? []).some((row) => row.eventMemberId === access.memberId)
  }

  async canSeeChecklistItem(access: EventAccess, checklistId: string) {
    const row = await this.repo.findChecklistConcealments(access.event.id, checklistId)
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
    const rows = await this.repo.findChecklistConcealmentsMany(access.event.id, unique)
    return new Set(
      rows.filter((row) => this.canSeeChecklistRow(access, row.concealments)).map((row) => row.id),
    )
  }

  async assertConcealmentTargets(eventId: string, memberIds: string[]) {
    const unique = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))]
    if (unique.length === 0) return
    const event = await this.repo.findLiveEventParent(eventId)
    if (!event) deny()

    const found = new Set((await this.repo.findMembersByIds(eventId, unique)).map((row) => row.id))
    const missing = unique.filter((id) => !found.has(id))
    if (missing.length > 0 && event.parentId) {
      const parentMembers = await this.repo.findMembersByIds(event.parentId, missing)
      const grants = await this.repo.findSubGrantsForMembers(
        eventId,
        parentMembers.map((row) => row.id),
      )
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
    const user = await this.repo.findActiveUserByClerkId(clerkId)
    if (!user) deny()

    const event = await this.repo.findLiveEvent(eventId)
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

    const member = await this.findAcceptedMember(eventId, user.id, user.email)
    if (member) {
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
      const parent = await this.repo.findLiveEvent(event.parentId)
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

      const parentMember = await this.findAcceptedMember(event.parentId, user.id, user.email)
      if (!parentMember) deny()

      const grant = await this.repo.findSubGrant(parentMember.id, eventId)
      if (!grant) deny()

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

  async loadMany(clerkId: string, eventIds: string[]): Promise<Map<string, EventAccess | null>> {
    const unique = [...new Set(eventIds.filter(Boolean))]
    const out = new Map<string, EventAccess | null>()
    if (unique.length === 0) return out

    const user = await this.repo.findActiveUserByClerkId(clerkId)
    if (!user) {
      for (const id of unique) out.set(id, null)
      return out
    }

    const events = unique.length === 0 ? [] : await this.repo.findLiveEvents(unique)
    const eventById = new Map(events.map((event) => [event.id, event] as const))
    const remaining: string[] = []

    for (const id of unique) {
      const event = eventById.get(id)
      if (!event) {
        out.set(id, null)
        continue
      }
      if (event.userId === user.id) {
        out.set(id, {
          user,
          event,
          isHost: true,
          role: 'HOST',
          surfaces: [...ALL_SURFACES],
        })
        continue
      }
      remaining.push(id)
    }

    if (remaining.length === 0) return out

    const members = await this.repo.findAcceptedMembersByUser(remaining, user.id)
    const memberByEvent = new Map(members.map((member) => [member.eventId, member]))
    const afterMember: string[] = []

    for (const id of remaining) {
      const member = memberByEvent.get(id)
      const event = eventById.get(id)
      if (member && event) {
        out.set(id, {
          user,
          event,
          isHost: false,
          role: member.role,
          surfaces: member.surfaces,
          memberId: member.id,
        })
        continue
      }
      afterMember.push(id)
    }

    if (afterMember.length === 0) return out

    const orphans = await this.repo.findAcceptedOrphansByEmail(afterMember, user.email)
    const orphanEvents = new Set<string>()
    for (const orphan of orphans) {
      const linked = await this.repo.linkMemberUser(orphan.id, user.id)
      const event = eventById.get(orphan.eventId)
      if (!event) continue
      orphanEvents.add(orphan.eventId)
      out.set(orphan.eventId, {
        user,
        event,
        isHost: false,
        role: linked.role,
        surfaces: linked.surfaces,
        memberId: linked.id,
      })
    }

    const leftover = afterMember.filter((id) => !orphanEvents.has(id))
    const parentIds = [
      ...new Set(
        leftover.map((id) => eventById.get(id)?.parentId).filter((id): id is string => Boolean(id)),
      ),
    ]
    const parents = parentIds.length === 0 ? [] : await this.repo.findLiveEvents(parentIds)
    const parentById = new Map(parents.map((event) => [event.id, event] as const))
    const needParentMember: string[] = []

    for (const id of leftover) {
      const event = eventById.get(id)
      if (!event?.parentId) {
        out.set(id, null)
        continue
      }
      const parent = parentById.get(event.parentId)
      if (!parent) {
        out.set(id, null)
        continue
      }
      if (parent.userId === user.id) {
        out.set(id, {
          user,
          event,
          isHost: true,
          role: 'HOST',
          surfaces: [...ALL_SURFACES],
        })
        continue
      }
      needParentMember.push(id)
    }

    if (needParentMember.length > 0) {
      const parentEventIds = [
        ...new Set(needParentMember.map((id) => eventById.get(id)!.parentId!)),
      ]
      const parentMembers = await this.repo.findAcceptedMembersByUser(parentEventIds, user.id)
      const parentMemberByEvent = new Map(parentMembers.map((member) => [member.eventId, member]))
      const parentOrphans = await this.repo.findAcceptedOrphansByEmail(parentEventIds, user.email)
      for (const orphan of parentOrphans) {
        const linked = await this.repo.linkMemberUser(orphan.id, user.id)
        parentMemberByEvent.set(orphan.eventId, linked)
      }

      const memberIds = [...parentMemberByEvent.values()].map((member) => member.id)
      const grants = await this.repo.findSubGrantsForEvents(memberIds, needParentMember)
      const grantByKey = new Map(
        grants.map((grant) => [`${grant.eventMemberId}:${grant.eventId}`, grant]),
      )

      for (const id of needParentMember) {
        if (out.has(id)) continue
        const event = eventById.get(id)
        const parentMember = event?.parentId ? parentMemberByEvent.get(event.parentId) : undefined
        const grant = parentMember ? grantByKey.get(`${parentMember.id}:${id}`) : undefined
        if (!event || !parentMember || !grant) {
          out.set(id, null)
          continue
        }
        out.set(id, {
          user,
          event,
          isHost: false,
          role: parentMember.role,
          surfaces: grant.surfaces,
          memberId: parentMember.id,
        })
      }
    }

    for (const id of unique) {
      if (!out.has(id)) out.set(id, null)
    }
    return out
  }

  /**
   * Accepted membership is bound to userId. Email is only used to finish
   * linking a row that was accepted before userId was written.
   */
  private async findAcceptedMember(eventId: string, userId: string, email: string) {
    const byUser = await this.repo.findAcceptedMemberByUser(eventId, userId)
    if (byUser) return byUser

    const orphan = await this.repo.findAcceptedOrphanByEmail(eventId, email)
    if (!orphan) return null

    return this.repo.linkMemberUser(orphan.id, userId)
  }

  async require(
    clerkId: string,
    eventId: string,
    opts?: { surface?: EventSurface; action?: AccessAction },
  ): Promise<EventAccess> {
    const access = await this.load(clerkId, eventId)
    const action = opts?.action ?? 'view'
    if (!allowsAction(access, action, opts?.surface)) deny()
    return access
  }

  /** Host, or EDITOR with SITE grant. Fail closed (404). SITE is not a planning tab. */
  async requireSite(clerkId: string, eventId: string): Promise<EventAccess> {
    const access = await this.load(clerkId, eventId)
    if (access.isHost) return access
    if (access.role === EventMemberRole.EDITOR && access.surfaces.includes(EventSurface.SITE)) {
      return access
    }
    deny()
  }

  /** Events this user hosts or has accepted membership on. */
  async listAccessibleEventIds(userId: string): Promise<string[]> {
    const [hosted, memberOf, granted] = await Promise.all([
      this.repo.listHostedEventIds(userId),
      this.repo.listMemberEventIds(userId),
      this.repo.listGrantedEventIds(userId),
    ])
    return [
      ...new Set([
        ...hosted.map((e) => e.id),
        ...memberOf.map((m) => m.eventId),
        ...granted.map((g) => g.eventId),
      ]),
    ]
  }
}
