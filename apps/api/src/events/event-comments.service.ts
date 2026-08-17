import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import {
  EventActivityAction,
  EventCommentSubject,
  EventSurface,
  NotificationType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { EventAccessService, type EventAccess } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto'

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const

const SUBJECT_SURFACE: Record<EventCommentSubject, EventSurface | null> = {
  SCHEDULE_ITEM: EventSurface.SCHEDULE,
  CHECKLIST_ITEM: EventSurface.CHECKLIST,
  BUDGET_ITEM: EventSurface.BUDGET,
  MOOD_BOARD_ITEM: EventSurface.MOODBOARD,
  EVENT: null,
}

const SUBJECT_TAB: Partial<Record<EventCommentSubject, string>> = {
  SCHEDULE_ITEM: 'schedule',
  CHECKLIST_ITEM: 'checklist',
  BUDGET_ITEM: 'budget',
  MOOD_BOARD_ITEM: 'moodboard',
  EVENT: 'overview',
}

export function commentHref(
  eventId: string,
  subjectType: EventCommentSubject,
  subjectId: string,
  commentId?: string,
): string {
  const tab = SUBJECT_TAB[subjectType]
  const comment = commentId ? `&comment=${commentId}` : ''
  if (!tab || tab === 'overview') {
    return `/events/${eventId}?tab=overview${commentId ? `&comment=${commentId}` : ''}`
  }
  return `/events/${eventId}?tab=${tab}&item=${subjectId}${comment}`
}

@Injectable()
export class EventCommentsService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private notifications: NotificationsService,
    private activity: EventActivityService,
  ) {}

  private surfaceFor(subjectType: EventCommentSubject): EventSurface | null {
    return SUBJECT_SURFACE[subjectType]
  }

  private async assertSubject(
    eventId: string,
    subjectType: EventCommentSubject,
    subjectId: string,
  ) {
    if (subjectType === EventCommentSubject.EVENT) {
      if (subjectId !== eventId) throw new NotFoundException('Event not found')
      return
    }
    if (subjectType === EventCommentSubject.SCHEDULE_ITEM) {
      const row = await this.prisma.eventScheduleItem.findFirst({
        where: { id: subjectId, eventId },
      })
      if (!row) throw new NotFoundException('Event not found')
      return
    }
    if (subjectType === EventCommentSubject.CHECKLIST_ITEM) {
      const row = await this.prisma.eventChecklist.findFirst({ where: { id: subjectId, eventId } })
      if (!row) throw new NotFoundException('Event not found')
      return
    }
    if (subjectType === EventCommentSubject.BUDGET_ITEM) {
      const row = await this.prisma.eventBudgetItem.findFirst({ where: { id: subjectId, eventId } })
      if (!row) throw new NotFoundException('Event not found')
      return
    }
    const row = await this.prisma.moodBoardItem.findFirst({ where: { id: subjectId, eventId } })
    if (!row) throw new NotFoundException('Event not found')
  }

  private requireSurface(
    access: EventAccess,
    subjectType: EventCommentSubject,
    action: 'view' | 'comment',
  ) {
    const surface = this.surfaceFor(subjectType)
    if (!surface) {
      if (action === 'comment' && !access.isHost && access.role === 'VIEWER') {
        throw new NotFoundException('Event not found')
      }
      return
    }
    const ok =
      action === 'comment'
        ? this.access.canComment(access, surface)
        : this.access.canSee(access, surface)
    if (!ok) throw new NotFoundException('Event not found')
  }

  async list(
    clerkId: string,
    eventId: string,
    subjectType: EventCommentSubject,
    subjectId: string,
  ) {
    const access = await this.access.require(clerkId, eventId)
    this.requireSurface(access, subjectType, 'view')
    await this.assertSubject(eventId, subjectType, subjectId)
    if (subjectType === EventCommentSubject.CHECKLIST_ITEM) {
      await this.access.assertCanSeeChecklistItem(access, subjectId)
    }

    const comments = await this.prisma.eventComment.findMany({
      where: {
        eventId,
        subjectType,
        subjectId,
        parentId: null,
        deletedAt: null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: { userId: true } },
        replies: {
          where: { deletedAt: null },
          include: {
            author: { select: AUTHOR_SELECT },
            mentions: { select: { userId: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return comments
  }

  async create(clerkId: string, eventId: string, dto: CreateCommentDto) {
    const surface = this.surfaceFor(dto.subjectType)
    const access = await this.access.require(clerkId, eventId, {
      action: 'comment',
      ...(surface ? { surface } : {}),
    })
    this.requireSurface(access, dto.subjectType, 'comment')
    await this.assertSubject(eventId, dto.subjectType, dto.subjectId)
    if (dto.subjectType === EventCommentSubject.CHECKLIST_ITEM) {
      await this.access.assertCanSeeChecklistItem(access, dto.subjectId)
    }

    let parentAuthorId: string | null = null
    if (dto.parentId) {
      const parent = await this.prisma.eventComment.findFirst({
        where: {
          id: dto.parentId,
          eventId,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          deletedAt: null,
        },
      })
      if (!parent) throw new NotFoundException('Comment not found')
      if (parent.parentId) throw new BadRequestException('Replies cannot be nested')
      parentAuthorId = parent.authorId
    }

    const mentionIds = [...new Set((dto.mentionUserIds ?? []).filter(Boolean))]
    const allowedIds = await this.allowedMentionUserIds(eventId, surface, access.user.id)
    const validMentions = mentionIds.filter((id) => allowedIds.has(id) && id !== access.user.id)

    const comment = await this.prisma.eventComment.create({
      data: {
        eventId,
        authorId: access.user.id,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        parentId: dto.parentId ?? null,
        body: dto.body.trim(),
        mentions: {
          create: validMentions.map((userId) => ({ userId })),
        },
      },
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: { userId: true } },
      },
    })

    const preview = dto.body.trim().slice(0, 140)
    const authorName = access.user.firstName ?? 'Someone'
    const href = commentHref(eventId, dto.subjectType, dto.subjectId, comment.id)
    const mentioned = new Set(validMentions)
    const notifyIds = new Set(validMentions)
    if (parentAuthorId && parentAuthorId !== access.user.id) notifyIds.add(parentAuthorId)

    for (const userId of notifyIds) {
      if (surface) {
        const canSee = await this.recipientCanSee(userId, eventId, surface)
        if (!canSee) continue
      }
      const title = mentioned.has(userId)
        ? `${authorName} mentioned you`
        : `${authorName} replied to your comment`
      await this.notifications.create(userId, NotificationType.EVENT_COMMENT, title, preview, {
        eventId,
        commentId: comment.id,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        surface,
        href,
      })
    }

    void this.activity.log({
      eventId,
      actorId: access.user.id,
      action: EventActivityAction.COMMENTED,
      surface,
      summary: `${authorName} commented`,
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
    })

    await this.activity.emitComment(eventId, surface, {
      type: 'event_comment',
      eventId,
      comment: {
        action: 'created',
        id: comment.id,
        eventId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        parentId: comment.parentId,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.author,
        mentions: comment.mentions,
      },
    })

    return comment
  }

  async update(clerkId: string, eventId: string, commentId: string, dto: UpdateCommentDto) {
    const access = await this.access.require(clerkId, eventId)
    const existing = await this.prisma.eventComment.findFirst({
      where: { id: commentId, eventId, deletedAt: null },
    })
    if (!existing) throw new NotFoundException('Comment not found')
    this.requireSurface(access, existing.subjectType, 'view')
    if (existing.subjectType === EventCommentSubject.CHECKLIST_ITEM) {
      await this.access.assertCanSeeChecklistItem(access, existing.subjectId)
    }
    if (existing.authorId !== access.user.id) throw new NotFoundException('Comment not found')

    const comment = await this.prisma.eventComment.update({
      where: { id: commentId },
      data: { body: dto.body.trim() },
      include: {
        author: { select: AUTHOR_SELECT },
        mentions: { select: { userId: true } },
      },
    })

    const surface = this.surfaceFor(comment.subjectType)
    await this.activity.emitComment(eventId, surface, {
      type: 'event_comment',
      eventId,
      comment: {
        action: 'updated',
        id: comment.id,
        eventId,
        subjectType: comment.subjectType,
        subjectId: comment.subjectId,
        parentId: comment.parentId,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.author,
        mentions: comment.mentions,
      },
    })

    return comment
  }

  async remove(clerkId: string, eventId: string, commentId: string) {
    const access = await this.access.require(clerkId, eventId)
    const comment = await this.prisma.eventComment.findFirst({
      where: { id: commentId, eventId, deletedAt: null },
    })
    if (!comment) throw new NotFoundException('Comment not found')
    this.requireSurface(access, comment.subjectType, 'view')
    if (comment.subjectType === EventCommentSubject.CHECKLIST_ITEM) {
      await this.access.assertCanSeeChecklistItem(access, comment.subjectId)
    }

    if (!access.isHost && comment.authorId !== access.user.id) {
      throw new NotFoundException('Comment not found')
    }

    await this.prisma.eventComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    })

    const surface = this.surfaceFor(comment.subjectType)
    await this.activity.emitComment(eventId, surface, {
      type: 'event_comment',
      eventId,
      comment: {
        action: 'deleted',
        id: comment.id,
        eventId,
        subjectType: comment.subjectType,
        subjectId: comment.subjectId,
        parentId: comment.parentId,
      },
    })

    return { deleted: true }
  }

  private async allowedMentionUserIds(
    eventId: string,
    surface: EventSurface | null,
    authorId: string,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId },
      select: { userId: true },
    })
    const members = await this.prisma.eventMember.findMany({
      where: { eventId, acceptedAt: { not: null }, userId: { not: null } },
      select: { userId: true, surfaces: true },
    })
    const ids = new Set<string>()
    if (event && event.userId !== authorId) ids.add(event.userId)
    for (const m of members) {
      if (!m.userId || m.userId === authorId) continue
      if (surface && !m.surfaces.includes(surface)) continue
      ids.add(m.userId)
    }
    return ids
  }

  private async recipientCanSee(userId: string, eventId: string, surface: EventSurface) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { userId: true },
    })
    if (!event) return false
    if (event.userId === userId) return true
    const member = await this.prisma.eventMember.findFirst({
      where: { eventId, userId, acceptedAt: { not: null } },
    })
    return !!member && member.surfaces.includes(surface)
  }
}
