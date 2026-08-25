import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { NotificationDeliveryService } from '../notifications/notification-delivery.service'
import { NotificationType } from '@prisma/client'

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name)

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private delivery: NotificationDeliveryService,
  ) {}

  /**
   * Runs at 8 AM every day.
   * Finds all incomplete checklist items due within the next 24 hours
   * that have not already been notified today.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDueReminders() {
    this.logger.log('Running daily checklist reminder job…')

    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(23, 59, 59, 999)

    // Re-notify if it's been more than 23 hours since last notification
    const reNotifyThreshold = new Date(now.getTime() - 23 * 60 * 60 * 1000)

    const items = await this.prisma.eventChecklist.findMany({
      where: {
        isCompleted: false,
        dueDate: { lte: tomorrow },
        OR: [{ notifiedAt: null }, { notifiedAt: { lte: reNotifyThreshold } }],
      },
      include: {
        event: {
          include: { user: true },
        },
      },
    })

    this.logger.log(`Found ${items.length} checklist item(s) to remind`)

    for (const item of items) {
      const { user } = item.event
      const dueDateLabel = item.dueDate
        ? new Date(item.dueDate).toLocaleDateString('en-CA', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'today'

      // ── In-app notification (always) ─────────────────────────────────
      await this.notifications.create(
        user.id,
        NotificationType.EVENT_REMINDER,
        'Checklist item due soon',
        `"${item.title}" for ${item.event.title} is due ${dueDateLabel}.`,
        {
          checklistItemId: item.id,
          eventId: item.eventId,
          href: `/events/${item.eventId}?tab=checklist&item=${item.id}`,
        },
      )

      // ── Email ─────────────────────────────────────────────────────────
      if (item.notifyByEmail) {
        await this.delivery.sendEmail({
          to: user.email,
          kind: 'notification',
          subject: `Reminder: "${item.title}" due ${dueDateLabel}`,
          html: this.delivery.buildChecklistReminderEmail({
            firstName: user.firstName,
            eventTitle: item.event.title,
            itemTitle: item.title,
            dueDate: dueDateLabel,
          }),
        })
      }

      // ── SMS ───────────────────────────────────────────────────────────
      if (item.notifyBySms && user.phone) {
        await this.delivery.sendSms({
          to: user.phone,
          body: `Djanora Reminder: "${item.title}" for ${item.event.title} is due ${dueDateLabel}. Log in to mark it complete.`,
        })
      }

      // ── Stamp notifiedAt ─────────────────────────────────────────────
      await this.prisma.eventChecklist.update({
        where: { id: item.id },
        data: { notifiedAt: now },
      })
    }

    this.logger.log('Reminder job complete.')
  }

  /**
   * Day after an event date, ask the host to review vendors they marked as booked.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendReviewRequests() {
    this.logger.log('Running review-request job…')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const inquiries = await this.prisma.inquiry.findMany({
      where: {
        status: 'BOOKED',
        reviewRequestedAt: null,
        event: {
          deletedAt: null,
          estimatedDate: { gte: yesterday, lt: today },
        },
      },
      select: {
        id: true,
        senderId: true,
        vendorProfile: { select: { id: true, slug: true, businessName: true } },
        event: { select: { id: true, title: true } },
      },
    })

    for (const inquiry of inquiries) {
      const event = inquiry.event
      if (!event) continue

      const already = await this.prisma.review.findUnique({
        where: {
          authorId_vendorProfileId: {
            authorId: inquiry.senderId,
            vendorProfileId: inquiry.vendorProfile.id,
          },
        },
        select: { id: true },
      })
      if (already) {
        await this.prisma.inquiry.update({
          where: { id: inquiry.id },
          data: { reviewRequestedAt: new Date() },
        })
        continue
      }

      await this.notifications.create(
        inquiry.senderId,
        NotificationType.REVIEW_REQUEST,
        'How was your vendor?',
        `Leave a review for ${inquiry.vendorProfile.businessName} from ${event.title}.`,
        {
          inquiryId: inquiry.id,
          eventId: event.id,
          href: `/vendors/${inquiry.vendorProfile.slug}?review=1`,
        },
      )
      await this.prisma.inquiry.update({
        where: { id: inquiry.id },
        data: { reviewRequestedAt: new Date() },
      })
    }

    this.logger.log(`Review-request job complete (${inquiries.length} booked inquiries).`)
  }
}
