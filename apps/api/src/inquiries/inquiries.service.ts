import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { InquiryMessageKind, InspirationVisibility, NotificationType, Prisma, EventSurface } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInquiryDto } from './dto/create-inquiry.dto'
import { PostInquiryMessageDto } from './dto/post-inquiry-message.dto'
import { SseService } from '../sse/sse.service'
import { NotificationsService } from '../notifications/notifications.service'
import { EventAccessService, allowsAction } from '../events/event-access.service'

const SHARE_PREVIEW = {
  calendar: 'Shared a calendar',
  booking: 'Shared a booking link',
} as const

@Injectable()
export class InquiriesService {
  private readonly messageEditWindowMs = 5 * 60 * 1000

  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: SseService,
    private readonly notifications: NotificationsService,
    private readonly access: EventAccessService,
  ) {}

  private lastActivityAt(inquiry: { createdAt: Date; messages?: { createdAt: Date }[] }) {
    const lastMsgAt = inquiry.messages?.[0]?.createdAt
    if (!lastMsgAt) return inquiry.createdAt
    return lastMsgAt > inquiry.createdAt ? lastMsgAt : inquiry.createdAt
  }

  private byRecency<T extends { createdAt: Date; messages?: { createdAt: Date }[] }>(inquiries: T[]) {
    return [...inquiries].sort(
      (a, b) => this.lastActivityAt(b).getTime() - this.lastActivityAt(a).getTime(),
    )
  }

  private lastMessageSelect = {
    where: { unsentAt: null },
    select: { message: true, kind: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  }

  private messageSelect = {
    id: true,
    message: true,
    kind: true,
    payload: true,
    createdAt: true,
    readAt: true,
    editedAt: true,
    unsentAt: true,
    sender: {
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        vendorProfile: { select: { businessName: true } },
      },
    },
  } as const

  private quotePreview(amount: number, currency: string) {
    return `Quote: $${amount.toLocaleString('en-CA')} ${currency}`
  }

  async createInquiry(clerkId: string, dto: CreateInquiryDto) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const eventId = dto.eventId?.trim() || null
    if (eventId) {
      const access = await this.access.load(clerkId, eventId)
      if (!allowsAction(access, 'edit', EventSurface.VENDORS)) {
        throw new ForbiddenException('You need edit access on this event to contact vendors')
      }
    }

    const vendor = await this.prisma.vendorProfile.findFirst({
      where: {
        OR: [{ id: dto.vendorProfileId }, { slug: dto.vendorProfileId }],
      },
    })
    if (!vendor) throw new NotFoundException('Vendor not found')
    const vendorProfileId = vendor.id

    let originPost: { id: string; title: string; imageUrl: string | null } | null = null
    if (dto.inspirationItemId) {
      const post = await this.prisma.inspirationItem.findUnique({
        where: { id: dto.inspirationItemId },
        select: { id: true, title: true, imageUrl: true, visibility: true, vendorProfileId: true },
      })
      if (!post || post.visibility === InspirationVisibility.DRAFT) {
        throw new BadRequestException('That look is not available')
      }
      if (post.vendorProfileId !== vendorProfileId) {
        throw new BadRequestException('That look does not belong to this vendor')
      }
      originPost = { id: post.id, title: post.title, imageUrl: post.imageUrl }
    }

    const existing = await this.prisma.inquiry.findFirst({
      where: {
        vendorProfileId,
        senderId: user.id,
        eventId,
      },
    })
    if (existing) {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: eventId
            ? 'You have already sent an inquiry to this vendor for this event'
            : 'You have already sent an inquiry to this vendor',
          inquiryId: existing.id,
        },
        HttpStatus.CONFLICT,
      )
    }

    const inquiry = await this.prisma.inquiry.create({
      data: {
        eventId,
        senderId: user.id,
        vendorProfileId,
        message: dto.message,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        originInspirationItemId: originPost?.id ?? null,
      },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        vendorProfile: {
          select: { id: true, businessName: true, slug: true, userId: true },
        },
      },
    })

    if (originPost) {
      await this.prisma.inquiryMessage.create({
        data: {
          inquiryId: inquiry.id,
          senderId: user.id,
          message: `Asked about ${originPost.title}`,
          kind: InquiryMessageKind.INSPIRATION,
          payload: {
            inspirationItemId: originPost.id,
            title: originPost.title,
            coverUrl: originPost.imageUrl,
          },
        },
      })
    }

    const vendorUserId = inquiry.vendorProfile?.userId
    if (vendorUserId && vendorUserId !== user.id) {
      const hostName = user.firstName ?? 'A host'
      await this.notifications.create(
        vendorUserId,
        NotificationType.INQUIRY_RECEIVED,
        'New inquiry',
        originPost
          ? `${hostName} asked about “${originPost.title}”.`
          : `${hostName} sent you a message about their event.`,
        { inquiryId: inquiry.id, href: `/inquiries?inquiry=${inquiry.id}` },
      )
    }

    const { vendorProfile, ...rest } = inquiry
    return {
      ...rest,
      vendorProfile: vendorProfile
        ? { id: vendorProfile.id, businessName: vendorProfile.businessName, slug: vendorProfile.slug }
        : vendorProfile,
    }
  }

  /** All inquiries received by the current user's vendor profile. */
  async getVendorInquiries(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')
    if (!user.vendorProfile) throw new NotFoundException('No vendor profile found')

    const inquiries = await this.prisma.inquiry.findMany({
      where: { vendorProfileId: user.vendorProfile.id },
      select: {
        id: true,
        status: true,
        message: true,
        eventDate: true,
        quotedAmount: true,
        currency: true,
        bookedAt: true,
        createdAt: true,
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, city: true },
        },
        event: {
          select: { id: true, title: true, estimatedDate: true },
        },
        originInspirationItem: {
          select: { id: true, title: true, imageUrl: true },
        },
        messages: this.lastMessageSelect,
      },
    })

    return this.byRecency(inquiries)
  }

  /** Accept or decline an inquiry — only the receiving vendor may do this. */
  async updateInquiryStatus(clerkId: string, inquiryId: string, status: 'ACCEPTED' | 'DECLINED') {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')
    if (!user.vendorProfile) throw new NotFoundException('No vendor profile found')

    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id: inquiryId, vendorProfileId: user.vendorProfile.id },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')

    return this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: status as any },
      select: { id: true, status: true },
    })
  }

  async getMyInquiries(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const inquiries = await this.prisma.inquiry.findMany({
      where: { senderId: user.id },
      select: {
        id: true,
        status: true,
        message: true,
        eventDate: true,
        bookedAt: true,
        createdAt: true,
        vendorProfile: {
          select: { id: true, businessName: true, slug: true, category: true },
        },
        event: {
          select: { id: true, title: true, estimatedDate: true },
        },
        originInspirationItem: {
          select: { id: true, title: true, imageUrl: true },
        },
        messages: this.lastMessageSelect,
      },
    })

    return this.byRecency(inquiries)
  }

  /** Get messages in a thread — accessible only by the sender or the receiving vendor. */
  async getMessages(clerkId: string, inquiryId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { senderId: true, vendorProfileId: true },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')

    const isParticipant =
      inquiry.senderId === user.id ||
      (user.vendorProfile && inquiry.vendorProfileId === user.vendorProfile.id)
    if (!isParticipant) throw new NotFoundException('Inquiry not found')

    const msgs = await this.prisma.inquiryMessage.findMany({
      where: { inquiryId },
      select: this.messageSelect,
      orderBy: { createdAt: 'asc' },
    })

    return msgs.map((m) => ({
      ...m,
      message: m.unsentAt ? '' : m.message,
      isCurrentUser: m.sender.id === user.id,
    }))
  }

  /** Post a reply or vendor share card — accessible only by the sender or the receiving vendor. */
  async postMessage(clerkId: string, inquiryId: string, dto: PostInquiryMessageDto) {
    const kind = dto.kind ?? 'TEXT'
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true, businessName: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        senderId: true,
        vendorProfileId: true,
        status: true,
        vendorProfile: { select: { userId: true, businessName: true } },
      },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')

    const isVendor = !!(user.vendorProfile && inquiry.vendorProfileId === user.vendorProfile.id)
    const isHost = inquiry.senderId === user.id
    if (!isVendor && !isHost) throw new NotFoundException('Inquiry not found')

    if (inquiry.status === 'DECLINED' || inquiry.status === 'CANCELLED') {
      throw new ForbiddenException('This inquiry is closed')
    }

    let message: string
    let payload: Prisma.InputJsonValue | undefined
    let nextStatus: 'QUOTED' | undefined

    if (kind === 'TEXT') {
      const text = dto.message?.trim()
      if (!text) throw new BadRequestException('Message cannot be empty')
      message = text
    } else if (kind === 'INSPIRATION') {
      if (!isHost) {
        throw new ForbiddenException('Only the host can share a look in this thread')
      }
      if (!dto.inspirationItemId) {
        throw new BadRequestException('inspirationItemId is required')
      }
      const post = await this.prisma.inspirationItem.findUnique({
        where: { id: dto.inspirationItemId },
        select: { id: true, title: true, imageUrl: true, visibility: true, vendorProfileId: true },
      })
      if (!post || post.visibility === InspirationVisibility.DRAFT) {
        throw new BadRequestException('That look is not available')
      }
      if (post.vendorProfileId !== inquiry.vendorProfileId) {
        throw new BadRequestException('That look does not belong to this vendor')
      }
      message = `Asked about ${post.title}`
      payload = {
        inspirationItemId: post.id,
        title: post.title,
        coverUrl: post.imageUrl,
      }
    } else {
      if (!isVendor) {
        throw new ForbiddenException('Only the vendor can share quotes and links')
      }
      if (kind === 'QUOTE') {
        if (!dto.amount || dto.amount < 1) {
          throw new BadRequestException('Quote amount must be at least 1')
        }
        const currency = (dto.currency ?? 'CAD').toUpperCase()
        message = this.quotePreview(dto.amount, currency)
        payload = {
          amount: dto.amount,
          currency,
          note: dto.note?.trim() || null,
        }
        if (inquiry.status !== 'BOOKED') nextStatus = 'QUOTED'
      } else {
        if (!dto.url || !dto.linkKind) {
          throw new BadRequestException('A calendar or booking link is required')
        }
        message = SHARE_PREVIEW[dto.linkKind]
        payload = {
          url: dto.url,
          label: dto.label?.trim() || null,
          linkKind: dto.linkKind,
        }
      }
    }

    const msg = await this.prisma.inquiryMessage.create({
      data: {
        inquiryId,
        senderId: user.id,
        message,
        kind: kind as InquiryMessageKind,
        ...(payload !== undefined ? { payload } : {}),
      },
      select: this.messageSelect,
    })

    const enriched = { ...msg, isCurrentUser: true }

    const recipientDbId = isHost ? inquiry.vendorProfile?.userId : inquiry.senderId

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        updatedAt: new Date(),
        ...(nextStatus ? { status: nextStatus, quotedAmount: dto.amount, currency: dto.currency ?? 'CAD' } : {}),
      },
    })

    if (recipientDbId) {
      this.sse.emit(recipientDbId, {
        type: 'new_message',
        inquiryId,
        message: { ...msg, isCurrentUser: false },
      })
      if (nextStatus) {
        this.sse.emit(recipientDbId, { type: 'inquiry_status', inquiryId, status: nextStatus })
        const vendorName = user.vendorProfile?.businessName ?? 'A vendor'
        await this.notifications.create(
          recipientDbId,
          NotificationType.INQUIRY_QUOTED,
          'New quote',
          `${vendorName} sent a quote for $${dto.amount!.toLocaleString('en-CA')} ${dto.currency ?? 'CAD'}. Not a contract — agree details with the vendor outside Djanora.`,
          { inquiryId, href: `/messages?inquiry=${inquiryId}` },
        )
      }
    }

    return enriched
  }

  /** Host accepts a vendor quote. Not a booking and not a contract. */
  async acceptQuote(clerkId: string, inquiryId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        senderId: true,
        status: true,
        vendorProfile: { select: { userId: true } },
      },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')
    if (inquiry.senderId !== user.id) {
      throw new ForbiddenException('Only the host can accept a quote')
    }
    if (inquiry.status === 'DECLINED' || inquiry.status === 'CANCELLED') {
      throw new ForbiddenException('This inquiry is closed')
    }
    if (inquiry.status === 'BOOKED') {
      throw new ConflictException('This inquiry is already booked')
    }

    const quote = await this.prisma.inquiryMessage.findFirst({
      where: { id: messageId, inquiryId, kind: 'QUOTE', unsentAt: null },
      select: { id: true, payload: true },
    })
    if (!quote) throw new NotFoundException('Quote not found')

    const payload = (quote.payload ?? {}) as {
      amount?: number
      currency?: string
      note?: string | null
      accepted?: boolean
      rejected?: boolean
      booked?: boolean
    }
    if (!payload.amount) throw new BadRequestException('Quote is missing an amount')
    if (payload.rejected) throw new BadRequestException('This quote was rejected')
    if (payload.accepted) return { id: inquiryId, status: inquiry.status }

    const siblings = await this.prisma.inquiryMessage.findMany({
      where: { inquiryId, kind: 'QUOTE', unsentAt: null, id: { not: quote.id } },
      select: { id: true, payload: true },
    })

    await this.prisma.$transaction([
      this.prisma.inquiry.update({
        where: { id: inquiryId },
        data: {
          quotedAmount: payload.amount,
          currency: payload.currency ?? 'CAD',
          updatedAt: new Date(),
        },
      }),
      this.prisma.inquiryMessage.update({
        where: { id: quote.id },
        data: { payload: { ...payload, accepted: true, rejected: false } as Prisma.InputJsonValue },
      }),
      ...siblings
        .filter((row) => (row.payload as { accepted?: boolean } | null)?.accepted)
        .map((row) =>
          this.prisma.inquiryMessage.update({
            where: { id: row.id },
            data: {
              payload: {
                ...(row.payload as object),
                accepted: false,
              } as Prisma.InputJsonValue,
            },
          }),
        ),
    ])

    const vendorUserId = inquiry.vendorProfile?.userId
    const updatedMsg = await this.prisma.inquiryMessage.findUnique({
      where: { id: quote.id },
      select: this.messageSelect,
    })
    if (vendorUserId) {
      if (updatedMsg) {
        this.sse.emit(vendorUserId, {
          type: 'message_updated',
          inquiryId,
          message: { ...updatedMsg, isCurrentUser: false },
        })
      }
      await this.notifications.create(
        vendorUserId,
        NotificationType.INQUIRY_QUOTED,
        'Quote accepted',
        `${user.firstName ?? 'A host'} accepted your quote. This is not a booking or a contract — confirm details with them directly.`,
        { inquiryId, href: `/inquiries?inquiry=${inquiryId}` },
      )
    }

    return { id: inquiryId, status: inquiry.status, quotedAmount: payload.amount }
  }

  /** Host rejects a vendor quote. Does not close the inquiry. */
  async rejectQuote(clerkId: string, inquiryId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        senderId: true,
        status: true,
        vendorProfile: { select: { userId: true } },
      },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')
    if (inquiry.senderId !== user.id) {
      throw new ForbiddenException('Only the host can reject a quote')
    }
    if (inquiry.status === 'DECLINED' || inquiry.status === 'CANCELLED') {
      throw new ForbiddenException('This inquiry is closed')
    }
    if (inquiry.status === 'BOOKED') {
      throw new ConflictException('This inquiry is already booked')
    }

    const quote = await this.prisma.inquiryMessage.findFirst({
      where: { id: messageId, inquiryId, kind: 'QUOTE', unsentAt: null },
      select: { id: true, payload: true },
    })
    if (!quote) throw new NotFoundException('Quote not found')

    const payload = (quote.payload ?? {}) as {
      amount?: number
      currency?: string
      note?: string | null
      accepted?: boolean
      rejected?: boolean
      booked?: boolean
    }
    if (payload.booked) throw new ConflictException('Booked quotes cannot be rejected')
    if (payload.rejected) return { id: inquiryId, status: inquiry.status }

    await this.prisma.$transaction([
      this.prisma.inquiry.update({
        where: { id: inquiryId },
        data: { updatedAt: new Date() },
      }),
      this.prisma.inquiryMessage.update({
        where: { id: quote.id },
        data: { payload: { ...payload, rejected: true, accepted: false } as Prisma.InputJsonValue },
      }),
    ])

    const vendorUserId = inquiry.vendorProfile?.userId
    const updatedMsg = await this.prisma.inquiryMessage.findUnique({
      where: { id: quote.id },
      select: this.messageSelect,
    })
    if (vendorUserId) {
      if (updatedMsg) {
        this.sse.emit(vendorUserId, {
          type: 'message_updated',
          inquiryId,
          message: { ...updatedMsg, isCurrentUser: false },
        })
      }
      await this.notifications.create(
        vendorUserId,
        NotificationType.INQUIRY_DECLINED,
        'Quote declined',
        `${user.firstName ?? 'A host'} declined your quote. This is not a closed inquiry — you can send another quote.`,
        { inquiryId, href: `/inquiries?inquiry=${inquiryId}` },
      )
    }

    return { id: inquiryId, status: inquiry.status }
  }

  /** Host confirms they booked the person outside Djanora. Requires an accepted quote. */
  async bookQuote(clerkId: string, inquiryId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: {
        senderId: true,
        status: true,
        vendorProfile: { select: { userId: true, businessName: true } },
      },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')
    if (inquiry.senderId !== user.id) {
      throw new ForbiddenException('Only the host can mark a person as booked')
    }
    if (inquiry.status === 'DECLINED' || inquiry.status === 'CANCELLED') {
      throw new ForbiddenException('This inquiry is closed')
    }
    if (inquiry.status === 'BOOKED') {
      throw new ConflictException('This inquiry is already booked')
    }

    const quote = await this.prisma.inquiryMessage.findFirst({
      where: { id: messageId, inquiryId, kind: 'QUOTE', unsentAt: null },
      select: { id: true, payload: true },
    })
    if (!quote) throw new NotFoundException('Quote not found')

    const payload = (quote.payload ?? {}) as {
      amount?: number
      currency?: string
      note?: string | null
      accepted?: boolean
      rejected?: boolean
    }
    if (!payload.amount) throw new BadRequestException('Quote is missing an amount')
    if (payload.rejected) throw new BadRequestException('This quote was rejected')
    if (!payload.accepted) {
      throw new BadRequestException('Accept the quote before marking this person as booked')
    }

    const bookedAt = new Date()
    const nextPayload = { ...payload, accepted: true, booked: true }

    const [updatedInquiry] = await this.prisma.$transaction([
      this.prisma.inquiry.update({
        where: { id: inquiryId },
        data: {
          status: 'BOOKED',
          bookedAt,
          quotedAmount: payload.amount,
          currency: payload.currency ?? 'CAD',
          updatedAt: bookedAt,
        },
        select: { id: true, status: true, bookedAt: true, quotedAmount: true, currency: true },
      }),
      this.prisma.inquiryMessage.update({
        where: { id: quote.id },
        data: { payload: nextPayload as Prisma.InputJsonValue },
      }),
    ])

    const vendorUserId = inquiry.vendorProfile?.userId
    const updatedMsg = await this.prisma.inquiryMessage.findUnique({
      where: { id: quote.id },
      select: this.messageSelect,
    })
    if (vendorUserId) {
      if (updatedMsg) {
        this.sse.emit(vendorUserId, {
          type: 'message_updated',
          inquiryId,
          message: { ...updatedMsg, isCurrentUser: false },
        })
      }
      this.sse.emit(vendorUserId, {
        type: 'inquiry_status',
        inquiryId,
        status: 'BOOKED',
      })
      await this.notifications.create(
        vendorUserId,
        NotificationType.BOOKING_CONFIRMED,
        'Marked as booked',
        `${user.firstName ?? 'A host'} said they booked you in Djanora. This is not a contract — confirm details with them directly.`,
        { inquiryId, href: `/inquiries?inquiry=${inquiryId}` },
      )
    }

    return updatedInquiry
  }

  /** Edit a sent message — sender only, within five minutes of creation. */
  async updateMessage(
    clerkId: string,
    inquiryId: string,
    messageId: string,
    message: string,
  ) {
    const nextMessage = message?.trim()
    if (!nextMessage) {
      throw new BadRequestException('Message cannot be empty')
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const existing = await this.prisma.inquiryMessage.findFirst({
      where: { id: messageId, inquiryId },
      select: {
        id: true,
        senderId: true,
        createdAt: true,
        unsentAt: true,
        kind: true,
        inquiry: {
          select: {
            senderId: true,
            vendorProfileId: true,
            vendorProfile: { select: { userId: true } },
          },
        },
      },
    })
    if (!existing) throw new NotFoundException('Message not found')

    const isParticipant =
      existing.inquiry.senderId === user.id ||
      (user.vendorProfile && existing.inquiry.vendorProfileId === user.vendorProfile.id)
    if (!isParticipant) throw new NotFoundException('Message not found')

    if (existing.senderId !== user.id) {
      throw new ForbiddenException('You can only edit your own messages')
    }

    if (existing.kind !== 'TEXT') {
      throw new ForbiddenException('Quotes and links cannot be edited')
    }

    if (existing.unsentAt) {
      throw new ForbiddenException('Unsent messages cannot be edited')
    }

    if (Date.now() - existing.createdAt.getTime() > this.messageEditWindowMs) {
      throw new ForbiddenException('Messages can only be edited within 5 minutes')
    }

    const editedAt = new Date()
    const updated = await this.prisma.inquiryMessage.update({
      where: { id: existing.id },
      data: { message: nextMessage, editedAt },
      select: this.messageSelect,
    })

    const recipientDbId =
      user.id === existing.inquiry.senderId
        ? existing.inquiry.vendorProfile?.userId
        : existing.inquiry.senderId

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { updatedAt: new Date() },
    })

    if (recipientDbId) {
      this.sse.emit(recipientDbId, {
        type: 'message_updated',
        inquiryId,
        message: { ...updated, isCurrentUser: false },
      })
    }

    return { ...updated, isCurrentUser: true }
  }

  /** Unsend a sent message — sender only, within five minutes of creation. */
  async unsendMessage(clerkId: string, inquiryId: string, messageId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const existing = await this.prisma.inquiryMessage.findFirst({
      where: { id: messageId, inquiryId },
      select: {
        id: true,
        senderId: true,
        createdAt: true,
        unsentAt: true,
        payload: true,
        inquiry: {
          select: {
            senderId: true,
            vendorProfileId: true,
            vendorProfile: { select: { userId: true } },
          },
        },
      },
    })
    if (!existing) throw new NotFoundException('Message not found')

    const isParticipant =
      existing.inquiry.senderId === user.id ||
      (user.vendorProfile && existing.inquiry.vendorProfileId === user.vendorProfile.id)
    if (!isParticipant) throw new NotFoundException('Message not found')

    if (existing.senderId !== user.id) {
      throw new ForbiddenException('You can only unsend your own messages')
    }

    const quoteFlags = existing.payload as { booked?: boolean; accepted?: boolean; rejected?: boolean } | null
    if (quoteFlags?.booked || quoteFlags?.accepted || quoteFlags?.rejected) {
      throw new ForbiddenException('Accepted, rejected, or booked quotes cannot be unsent')
    }

    if (existing.unsentAt) {
      throw new ForbiddenException('Message is already unsent')
    }

    if (Date.now() - existing.createdAt.getTime() > this.messageEditWindowMs) {
      throw new ForbiddenException('Messages can only be unsent within 5 minutes')
    }

    const unsentAt = new Date()
    await this.prisma.inquiryMessage.update({
      where: { id: existing.id },
      data: { unsentAt, message: '' },
    })

    await this.prisma.inquiry.update({
      where: { id: inquiryId },
      data: { updatedAt: new Date() },
    })

    const recipientDbId =
      user.id === existing.inquiry.senderId
        ? existing.inquiry.vendorProfile?.userId
        : existing.inquiry.senderId

    if (recipientDbId) {
      this.sse.emit(recipientDbId, {
        type: 'message_unsent',
        inquiryId,
        unsent: { messageId: existing.id, unsentAt },
      })
    }

    return { id: existing.id, unsentAt, isCurrentUser: true }
  }

  /** Mark all messages from the other participant as read by the current user. */
  async markMessagesRead(clerkId: string, inquiryId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      include: { vendorProfile: { select: { id: true } } },
    })
    if (!user) throw new NotFoundException('User not found')

    const inquiry = await this.prisma.inquiry.findUnique({
      where: { id: inquiryId },
      select: { senderId: true, vendorProfileId: true },
    })
    if (!inquiry) throw new NotFoundException('Inquiry not found')

    const isParticipant =
      inquiry.senderId === user.id ||
      (user.vendorProfile && inquiry.vendorProfileId === user.vendorProfile.id)
    if (!isParticipant) throw new NotFoundException('Inquiry not found')

    const unreadMessages = await this.prisma.inquiryMessage.findMany({
      where: {
        inquiryId,
        senderId: { not: user.id },
        readAt: null,
        unsentAt: null,
      },
      select: { id: true, senderId: true },
    })

    if (unreadMessages.length === 0) {
      return { messageIds: [], readAt: null }
    }

    const readAt = new Date()
    const messageIds = unreadMessages.map((m) => m.id)

    await this.prisma.inquiryMessage.updateMany({
      where: { id: { in: messageIds } },
      data: { readAt },
    })

    for (const senderId of new Set(unreadMessages.map((m) => m.senderId))) {
      this.sse.emit(senderId, {
        type: 'messages_read',
        inquiryId,
        read: { messageIds, readAt },
      })
    }

    return { messageIds, readAt }
  }

  async getEventInquiries(clerkId: string, eventId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.VENDORS, action: 'view' })

    const inquiries = await this.prisma.inquiry.findMany({
      where: { eventId },
      select: {
        id: true,
        vendorProfileId: true,
        status: true,
        message: true,
        createdAt: true,
        vendorProfile: {
          select: { id: true, businessName: true, slug: true, category: true },
        },
        messages: this.lastMessageSelect,
      },
    })

    return this.byRecency(inquiries)
  }
}
