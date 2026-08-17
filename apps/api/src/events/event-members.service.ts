import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { NotificationType, EventMemberRole, EventSurface } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { UsersService } from '../users/users.service'
import { ConfigService } from '@nestjs/config'
import { EventAccessService, ALL_SURFACES } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { ChildGrantDto, InviteMemberDto, UpdateMemberDto } from './dto/members.dto'
import { EventActivityAction } from '@prisma/client'
import { escapeHtml } from '../common/escape-html'

const MEMBER_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
} as const

const ROLE_LABELS: Record<EventMemberRole, string> = {
  EDITOR: 'Editor',
  COMMENTER: 'Commenter',
  VIEWER: 'Viewer',
}

const SURFACE_LABELS: Record<EventSurface, string> = {
  SCHEDULE: 'Schedule',
  CHECKLIST: 'Checklist',
  BUDGET: 'Budget',
  MOODBOARD: 'Mood board',
  VENDORS: 'Vendors',
  GUESTS: 'Guests',
}

@Injectable()
export class EventMembersService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private notifications: NotificationsService,
    private delivery: NotificationDeliveryService,
    private users: UsersService,
    private config: ConfigService,
    private activity: EventActivityService,
  ) {}

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') ?? 'http://localhost:3000'
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase()
  }

  async list(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId)
    const host = await this.prisma.user.findUnique({
      where: { id: access.event.userId },
      select: MEMBER_USER_SELECT,
    })
    const members = await this.prisma.eventMember.findMany({
      where: { eventId },
      include: {
        user: { select: MEMBER_USER_SELECT },
        subGrants: { select: { eventId: true, surfaces: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      host: host
        ? {
            id: host.id,
            email: host.email,
            role: 'HOST' as const,
            surfaces: ALL_SURFACES,
            acceptedAt: access.event.createdAt,
            isHost: true,
            user: host,
          }
        : null,
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        role: m.role,
        surfaces: m.surfaces,
        childGrants: access.isHost ? m.subGrants : [],
        acceptedAt: m.acceptedAt,
        createdAt: m.createdAt,
        isHost: false,
        user: m.user,
        inviteUrl:
          access.isHost && !m.acceptedAt ? `${this.webUrl}/events/join/${m.token}` : undefined,
      })),
    }
  }

  /** People the viewer can @mention on this event, optionally limited to a surface. */
  async listMentionable(clerkId: string, eventId: string, surface?: EventSurface) {
    const access = await this.access.require(clerkId, eventId)
    const host = await this.prisma.user.findUnique({
      where: { id: access.event.userId },
      select: MEMBER_USER_SELECT,
    })
    const members = await this.prisma.eventMember.findMany({
      where: { eventId, acceptedAt: { not: null }, userId: { not: null } },
      include: { user: { select: MEMBER_USER_SELECT } },
    })
    const parentGrants = access.event.parentId
      ? await this.prisma.eventSubGrant.findMany({
          where: {
            eventId,
            member: { acceptedAt: { not: null }, userId: { not: null } },
          },
          include: { member: { include: { user: { select: MEMBER_USER_SELECT } } } },
        })
      : []

    const people: Array<{
      id: string
      firstName: string | null
      lastName: string | null
      email: string
      role: string
    }> = []

    if (host && host.id !== access.user.id) {
      people.push({ ...host, role: 'HOST' })
    }

    for (const member of members) {
      if (!member.user || member.user.id === access.user.id) continue
      if (surface && !member.surfaces.includes(surface)) continue
      people.push({ ...member.user, role: member.role })
    }

    for (const grant of parentGrants) {
      const person = grant.member.user
      if (!person || person.id === access.user.id) continue
      if (surface && !grant.surfaces.includes(surface)) continue
      people.push({ ...person, role: grant.member.role })
    }

    const seen = new Set<string>()
    return people.filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }

  private async assertChildGrants(parentId: string, grants?: ChildGrantDto[]) {
    if (!grants?.length) return
    const children = await this.prisma.event.findMany({
      where: { parentId, deletedAt: null, id: { in: grants.map((g) => g.eventId) } },
      select: { id: true },
    })
    if (children.length !== grants.length) {
      throw new BadRequestException('Can only grant access to sub-events of this event')
    }
  }

  async invite(clerkId: string, eventId: string, dto: InviteMemberDto) {
    const { user: host, event } = await this.access.require(clerkId, eventId, { action: 'host' })
    const email = this.normalizeEmail(dto.email)
    if (email === host.email.toLowerCase()) {
      throw new BadRequestException('You already own this event')
    }
    if (event.parentId && dto.childGrants?.length) {
      throw new BadRequestException('Invite to sub-events from the parent event')
    }
    if (dto.surfaces.length === 0 && !dto.childGrants?.length) {
      throw new BadRequestException('Pick at least one tab or sub-event')
    }
    await this.assertChildGrants(eventId, dto.childGrants)

    const existing = await this.prisma.eventMember.findFirst({
      where: { eventId, email: { equals: email, mode: 'insensitive' } },
    })
    if (existing) {
      throw new BadRequestException('That person is already invited')
    }

    const invitee = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })

    const member = await this.prisma.eventMember.create({
      data: {
        eventId,
        email,
        role: dto.role,
        surfaces: dto.surfaces,
        invitedById: host.id,
        userId: invitee?.id ?? null,
        token: randomBytes(24).toString('hex'),
        subGrants: dto.childGrants?.length
          ? {
              create: dto.childGrants.map((grant) => ({
                eventId: grant.eventId,
                surfaces: grant.surfaces,
              })),
            }
          : undefined,
      },
      include: {
        user: { select: MEMBER_USER_SELECT },
        event: { select: { title: true, eventType: true, estimatedDate: true } },
        subGrants: { select: { eventId: true, surfaces: true } },
      },
    })

    const joinUrl = `${this.webUrl}/events/join/${member.token}`
    const hostName = host.firstName ?? 'Someone'

    void this.activity.log({
      eventId,
      actorId: host.id,
      action: EventActivityAction.INVITED,
      surface: null,
      summary: `${hostName} invited ${email}`,
      subjectType: 'EVENT_MEMBER',
      subjectId: member.id,
    })

    await this.delivery.sendEmail({
      to: email,
      kind: 'invitation',
      subject: `${hostName} invited you to plan ${member.event.title}`,
      html: this.buildPlannerInviteEmail({
        hostName,
        eventTitle: member.event.title,
        eventDate: member.event.estimatedDate
          ? new Date(member.event.estimatedDate).toLocaleDateString('en-CA', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : null,
        role: ROLE_LABELS[member.role],
        surfaces: member.surfaces.map((s) => SURFACE_LABELS[s]),
        joinUrl,
      }),
    })

    if (invitee) {
      await this.notifications.create(
        invitee.id,
        NotificationType.EVENT_INVITE,
        `You're invited to plan ${member.event.title}`,
        `${hostName} invited you to collaborate.`,
        { eventId, token: member.token, href: `/events/join/${member.token}` },
      )
    }

    return {
      id: member.id,
      email: member.email,
      role: member.role,
      surfaces: member.surfaces,
      childGrants: member.subGrants,
      acceptedAt: member.acceptedAt,
      createdAt: member.createdAt,
      isHost: false,
      user: member.user,
      inviteUrl: joinUrl,
    }
  }

  async update(clerkId: string, eventId: string, memberId: string, dto: UpdateMemberDto) {
    await this.access.require(clerkId, eventId, { action: 'host' })
    const member = await this.prisma.eventMember.findFirst({ where: { id: memberId, eventId } })
    if (!member) throw new NotFoundException('Member not found')
    if (dto.childGrants) await this.assertChildGrants(eventId, dto.childGrants)

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.childGrants) {
        await tx.eventSubGrant.deleteMany({ where: { eventMemberId: memberId } })
        if (dto.childGrants.length > 0) {
          await tx.eventSubGrant.createMany({
            data: dto.childGrants.map((grant) => ({
              eventMemberId: memberId,
              eventId: grant.eventId,
              surfaces: grant.surfaces,
            })),
          })
        }
      }
      return tx.eventMember.update({
        where: { id: memberId },
        data: {
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.surfaces !== undefined && { surfaces: dto.surfaces }),
        },
        include: {
          user: { select: MEMBER_USER_SELECT },
          subGrants: { select: { eventId: true, surfaces: true } },
        },
      })
    })

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      surfaces: updated.surfaces,
      childGrants: updated.subGrants,
      acceptedAt: updated.acceptedAt,
      createdAt: updated.createdAt,
      isHost: false,
      user: updated.user,
      inviteUrl: updated.acceptedAt ? undefined : `${this.webUrl}/events/join/${updated.token}`,
    }
  }

  async remove(clerkId: string, eventId: string, memberId: string) {
    const access = await this.access.require(clerkId, eventId)
    const member = await this.prisma.eventMember.findFirst({ where: { id: memberId, eventId } })
    if (!member) throw new NotFoundException('Member not found')

    const isSelf = access.memberId === member.id
    if (!access.isHost && !isSelf) throw new NotFoundException('Member not found')

    await this.prisma.eventMember.delete({ where: { id: memberId } })
    return { deleted: true }
  }

  async leave(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId)
    if (access.isHost) throw new BadRequestException('Hosts cannot leave their own event')
    if (!access.memberId) throw new NotFoundException('Event not found')
    const direct = await this.prisma.eventMember.findFirst({
      where: { id: access.memberId, eventId },
    })
    if (direct) {
      await this.prisma.eventMember.delete({ where: { id: access.memberId } })
    } else {
      await this.prisma.eventSubGrant.deleteMany({
        where: { eventMemberId: access.memberId, eventId },
      })
    }
    return { left: true }
  }

  async previewByToken(token: string) {
    const member = await this.prisma.eventMember.findUnique({
      where: { token },
      include: {
        event: { select: { title: true, eventType: true, estimatedDate: true, deletedAt: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    })
    if (!member || member.event.deletedAt) throw new NotFoundException('Invite not found')

    if (member.acceptedAt) {
      return { accepted: true as const, event: { title: member.event.title } }
    }

    return {
      accepted: false as const,
      event: {
        title: member.event.title,
        eventType: member.event.eventType,
        estimatedDate: member.event.estimatedDate,
      },
      invitedBy: member.invitedBy,
      role: member.role,
      surfaces: member.surfaces,
    }
  }

  async listPending(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.eventMember.findMany({
      where: {
        acceptedAt: null,
        email: { equals: user.email, mode: 'insensitive' },
        event: { deletedAt: null },
      },
      include: {
        event: { select: { id: true, title: true, eventType: true, estimatedDate: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async accept(clerkId: string, token: string) {
    const user = await this.users.ensureFromClerk(clerkId)

    const member = await this.prisma.eventMember.findUnique({
      where: { token },
      include: { event: true },
    })
    if (!member || member.event.deletedAt) throw new NotFoundException('Invite not found')
    if (member.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException('This invite was sent to a different email')
    }
    if (member.acceptedAt) {
      return { eventId: member.eventId, alreadyAccepted: true }
    }

    await this.prisma.eventMember.update({
      where: { id: member.id },
      data: { userId: user.id, acceptedAt: new Date() },
    })

    return { eventId: member.eventId, alreadyAccepted: false }
  }

  private buildPlannerInviteEmail(opts: {
    hostName: string
    eventTitle: string
    eventDate: string | null
    role: string
    surfaces: string[]
    joinUrl: string
  }): string {
    const title = escapeHtml(opts.eventTitle)
    const host = escapeHtml(opts.hostName)
    const dateLine = opts.eventDate ? escapeHtml(opts.eventDate) : 'Date TBD'
    const tabs = escapeHtml(opts.surfaces.join(', '))
    return `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f1e16;color:#e8f0ea;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a3a2a,#0f2a1e);padding:32px 32px 24px">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c9973a">You're invited to plan</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">${title}</h1>
          <p style="margin:8px 0 0;color:#7ebd9a;font-size:14px">${dateLine}</p>
        </div>
        <div style="padding:24px 32px">
          <p style="color:#c8ddd0;font-size:15px;line-height:1.6">
            <strong>${host}</strong> invited you to collaborate on this event as a ${escapeHtml(opts.role)}.
          </p>
          <p style="color:#c8ddd0;font-size:15px;line-height:1.6">
            You'll be able to see: <strong>${tabs}</strong>.
          </p>
          <div style="margin:28px 0;text-align:center">
            <a href="${opts.joinUrl}"
               style="display:inline-block;background:#c9973a;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
              Open invite
            </a>
          </div>
          <p style="color:#5a7a6a;font-size:12px;margin:0">
            Use the email this invite was sent to when you sign in. Or copy this link:
            <a href="${opts.joinUrl}" style="color:#7ebd9a">${opts.joinUrl}</a>
          </p>
        </div>
        <div style="padding:16px 32px 24px;border-top:1px solid #1e3a2a">
          <p style="margin:0;color:#3d6b4a;font-size:11px">Sent via Djanora · Event Planning</p>
        </div>
      </div>
    `
  }
}
