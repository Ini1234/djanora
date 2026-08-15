import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SseService } from '../sse/sse.service'
import { NotificationType, Prisma } from '@prisma/client'

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private sse: SseService,
  ) {}

  async findByUser(clerkId: string, limit = 20) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    const notifications = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    })

    return { notifications, unreadCount }
  }

  async markRead(clerkId: string, notificationId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')

    return this.prisma.notification.update({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true },
    })
  }

  async markAllRead(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
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
        metadata:
          metadata !== undefined
            ? (metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
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
