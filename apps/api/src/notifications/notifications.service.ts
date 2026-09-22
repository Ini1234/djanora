import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SseService } from '../sse/sse.service'
import { NotificationType, Prisma } from '@prisma/client'
import { liveUserWhere } from '../common/active-user'

const NOTIFICATION_LIMIT_MAX = 100

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private sse: SseService,
  ) {}

  async findByUser(clerkId: string, limit = 20) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')
    limit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), NOTIFICATION_LIMIT_MAX)
      : 20

    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ])

    return { notifications, unreadCount }
  }

  async findOne(clerkId: string, notificationId: string) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
    })
    if (!notification) throw new NotFoundException('Notification not found')
    return notification
  }

  async markRead(clerkId: string, notificationId: string) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.notification.update({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    })
  }

  async markAllRead(clerkId: string) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    })
  }

  /**
   * Create a DB notification and immediately push it to the user's SSE stream.
   * If the user is not currently connected, the event is simply dropped —
   * they will see it on the next page load via the initial fetch.
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        metadata: metadata !== undefined ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })

    // Push immediately to the user's live SSE connection (if any)
    this.sse.emit(userId, {
      type: 'notification',
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        metadata: notification.metadata,
      },
    })

    return notification
  }
}
