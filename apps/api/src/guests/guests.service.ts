import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { escapeHtml } from '../common/escape-html'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { ConfigService } from '@nestjs/config'
import { EventAccessService } from '../events/event-access.service'
import { EventActivityService } from '../events/event-activity.service'
import { EventSurface } from '@prisma/client'
import {
  CreateGuestDto,
  UpdateGuestDto,
  SendInviteDto,
  BulkSendInviteDto,
  SubmitRsvpDto,
} from './dto/guests.dto'
import { RsvpStatus } from '@prisma/client'

@Injectable()
export class GuestsService {
  constructor(
    private prisma: PrismaService,
    private delivery: NotificationDeliveryService,
    private config: ConfigService,
    private access: EventAccessService,
    private activity: EventActivityService,
  ) {}

  // ─── helpers ───────────────────────────────────────────────────────────────

  private get webUrl(): string {
    return this.config.get<string>('WEB_URL') ?? 'http://localhost:3000'
  }

  private async assertEventAccess(clerkId: string, eventId: string, action: 'view' | 'edit') {
    return this.access.require(clerkId, eventId, { surface: EventSurface.GUESTS, action })
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async listGuests(clerkId: string, eventId: string) {
    await this.assertEventAccess(clerkId, eventId, 'view')
    return this.prisma.guest.findMany({
      where: { eventId },
      include: { invite: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async addGuest(clerkId: string, eventId: string, dto: CreateGuestDto) {
    await this.assertEventAccess(clerkId, eventId, 'edit')
    const guest = await this.prisma.guest.create({
      data: {
        eventId,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        note: dto.note ?? null,
        plusOneAllowed: dto.plusOneAllowed ?? false,
        tableNumber: dto.tableNumber ?? null,
      },
      include: { invite: true },
    })
    void this.activity.touchEvent(eventId)
    return guest
  }

  async updateGuest(
    clerkId: string,
    eventId: string,
    guestId: string,
    dto: UpdateGuestDto,
  ) {
    await this.assertEventAccess(clerkId, eventId, 'edit')
    const guest = await this.prisma.guest.findFirst({ where: { id: guestId, eventId } })
    if (!guest) throw new NotFoundException('Guest not found')

    const updated = await this.prisma.guest.update({
      where: { id: guestId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.plusOneAllowed !== undefined && { plusOneAllowed: dto.plusOneAllowed }),
        ...(dto.tableNumber !== undefined && { tableNumber: dto.tableNumber }),
      },
      include: { invite: true },
    })
    void this.activity.touchEvent(eventId)
    return updated
  }

  async removeGuest(clerkId: string, eventId: string, guestId: string) {
    await this.assertEventAccess(clerkId, eventId, 'edit')
    const guest = await this.prisma.guest.findFirst({ where: { id: guestId, eventId } })
    if (!guest) throw new NotFoundException('Guest not found')
    await this.prisma.guest.delete({ where: { id: guestId } })
    void this.activity.touchEvent(eventId)
    return { deleted: true }
  }

  // ─── Invite sending ────────────────────────────────────────────────────────

  async sendInvite(
    clerkId: string,
    eventId: string,
    guestId: string,
    dto: SendInviteDto,
  ) {
    const { event } = await this.assertEventAccess(clerkId, eventId, 'edit')

    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, eventId },
      include: { invite: true },
    })
    if (!guest) throw new NotFoundException('Guest not found')

    const needsEmail = dto.via === 'email' || dto.via === 'both'
    const needsSms = dto.via === 'sms' || dto.via === 'both'

    if (needsEmail && !guest.email)
      throw new BadRequestException('Guest has no email address')
    if (needsSms && !guest.phone)
      throw new BadRequestException('Guest has no phone number')

    // Upsert invite (resend is allowed)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const invite = await this.prisma.guestInvite.upsert({
      where: { guestId },
      update: {
        sentAt: new Date(),
        sentVia: dto.via,
        customNote: dto.customNote ?? null,
        expiresAt,
      },
      create: {
        guestId,
        eventId,
        token: randomBytes(32).toString('hex'),
        sentAt: new Date(),
        sentVia: dto.via,
        customNote: dto.customNote ?? null,
        expiresAt,
      },
    })

    const rsvpUrl = `${this.webUrl}/rsvp/${invite.token}`
    const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(' ')
    const eventDate = event.estimatedDate
      ? new Date(event.estimatedDate).toLocaleDateString('en-CA', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'date TBD'

    // ── Email ──────────────────────────────────────────────────────────────
    if (needsEmail && guest.email) {
      await this.delivery.sendEmail({
        to: guest.email,
        subject: `You're invited to ${event.title}! 🎉`,
        html: this.buildInviteEmail({
          guestName,
          eventTitle: event.title,
          eventDate,
          location: event.location,
          customNote: dto.customNote,
          rsvpUrl,
        }),
      })
    }

    // ── SMS ────────────────────────────────────────────────────────────────
    if (needsSms && guest.phone) {
      await this.delivery.sendSms({
        to: guest.phone,
        body: `Hi ${guest.firstName}! You're invited to ${event.title} on ${eventDate}. RSVP here: ${rsvpUrl}`,
      })
    }

    return { ...invite, rsvpUrl }
  }

  async bulkSendInvites(clerkId: string, eventId: string, dto: BulkSendInviteDto) {
    const results: { guestId: string; success: boolean; error?: string }[] = []

    for (const guestId of dto.guestIds) {
      try {
        await this.sendInvite(clerkId, eventId, guestId, {
          via: dto.via,
          customNote: dto.customNote,
        })
        results.push({ guestId, success: true })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ guestId, success: false, error: message })
      }
    }

    return results
  }

  // ─── Public RSVP (no auth) ─────────────────────────────────────────────────

  async getInviteByToken(token: string) {
    const invite = await this.prisma.guestInvite.findUnique({
      where: { token },
      include: {
        guest: { select: { firstName: true, lastName: true, plusOneAllowed: true } },
        event: {
          select: {
            id: true,
            title: true,
            eventType: true,
            estimatedDate: true,
            location: true,
          },
        },
      },
    })

    if (!invite) throw new NotFoundException('Invite not found')
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new ForbiddenException('This invite has expired')
    }

    return toPublicRsvp(invite)
  }

  async submitRsvp(token: string, dto: SubmitRsvpDto) {
    const invite = await this.prisma.guestInvite.findUnique({ where: { token } })
    if (!invite) throw new NotFoundException('Invite not found')
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new ForbiddenException('This invite has expired')
    }

    return this.prisma.guestInvite.update({
      where: { token },
      data: {
        rsvpStatus: dto.status as RsvpStatus,
        rsvpAt: new Date(),
        plusOneName: dto.plusOneName ?? null,
        dietaryNote: dto.dietaryNote ?? null,
        guestMessage: dto.guestMessage ?? null,
      },
      include: { guest: true, event: { select: { title: true } } },
    })
  }

  // ─── Email template ────────────────────────────────────────────────────────

  private buildInviteEmail(opts: {
    guestName: string
    eventTitle: string
    eventDate: string
    location: string | null
    customNote?: string
    rsvpUrl: string
  }): string {
    return `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0f1e16;color:#e8f0ea;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a3a2a,#0f2a1e);padding:32px 32px 24px">
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c9973a">You're Invited</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff">${escapeHtml(opts.eventTitle)}</h1>
          <p style="margin:8px 0 0;color:#7ebd9a;font-size:14px">
            ${escapeHtml(opts.eventDate)}${opts.location ? ` · ${escapeHtml(opts.location)}` : ''}
          </p>
        </div>

        <div style="padding:24px 32px">
          <p style="color:#c8ddd0;font-size:15px;line-height:1.6">
            Hi <strong>${escapeHtml(opts.guestName)}</strong>,
          </p>
          <p style="color:#c8ddd0;font-size:15px;line-height:1.6">
            We'd love for you to join us for <strong>${escapeHtml(opts.eventTitle)}</strong>. Please let us know if you'll be able to make it.
          </p>

          ${
            opts.customNote
              ? `<div style="background:#1a2e22;border-left:3px solid #c9973a;padding:12px 16px;border-radius:6px;margin:16px 0">
                  <p style="margin:0;color:#f0e4c8;font-style:italic;font-size:14px">"${escapeHtml(opts.customNote)}"</p>
                </div>`
              : ''
          }

          <div style="margin:28px 0;text-align:center">
            <a href="${opts.rsvpUrl}"
               style="display:inline-block;background:#c9973a;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.3px">
              RSVP Now
            </a>
          </div>

          <p style="color:#5a7a6a;font-size:12px;margin:0">
            Or copy this link: <a href="${opts.rsvpUrl}" style="color:#7ebd9a">${opts.rsvpUrl}</a>
          </p>
        </div>

        <div style="padding:16px 32px 24px;border-top:1px solid #1e3a2a">
          <p style="margin:0;color:#3d6b4a;font-size:11px">
            Sent via Djanora · Event Planning
          </p>
        </div>
      </div>
    `
  }
}

export function toPublicRsvp(invite: {
  id: string
  rsvpStatus: string
  rsvpAt: Date | null
  plusOneName: string | null
  dietaryNote: string | null
  guestMessage: string | null
  guest: { firstName: string; lastName: string | null; plusOneAllowed: boolean }
  event: {
    id: string
    title: string
    eventType: string
    estimatedDate: Date | null
    location: string | null
  }
}) {
  return {
    id: invite.id,
    rsvpStatus: invite.rsvpStatus,
    rsvpAt: invite.rsvpAt,
    plusOneName: invite.plusOneName,
    dietaryNote: invite.dietaryNote,
    guestMessage: invite.guestMessage,
    guest: {
      firstName: invite.guest.firstName,
      lastName: invite.guest.lastName,
      plusOneAllowed: invite.guest.plusOneAllowed,
    },
    event: {
      id: invite.event.id,
      title: invite.event.title,
      eventType: invite.event.eventType,
      estimatedDate: invite.event.estimatedDate,
      location: invite.event.location,
    },
  }
}
