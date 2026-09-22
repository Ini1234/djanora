import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { liveUserWhere } from '../common/active-user'

@Injectable()
export class EventAccessRepository {
  constructor(private prisma: PrismaService) {}

  findActiveUserByClerkId(clerkId: string) {
    return this.prisma.user.findFirst({
      where: liveUserWhere(clerkId),
    })
  }

  findLiveEvent(eventId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
  }

  findLiveEvents(eventIds: string[]) {
    return this.prisma.event.findMany({
      where: { id: { in: eventIds }, deletedAt: null },
    })
  }

  findAcceptedMembersByUser(eventIds: string[], userId: string) {
    return this.prisma.eventMember.findMany({
      where: { eventId: { in: eventIds }, acceptedAt: { not: null }, userId },
    })
  }

  findAcceptedOrphansByEmail(eventIds: string[], email: string) {
    return this.prisma.eventMember.findMany({
      where: {
        eventId: { in: eventIds },
        acceptedAt: { not: null },
        userId: null,
        email: { equals: email, mode: 'insensitive' },
      },
    })
  }

  findSubGrantsForEvents(memberIds: string[], eventIds: string[]) {
    return this.prisma.eventSubGrant.findMany({
      where: { eventMemberId: { in: memberIds }, eventId: { in: eventIds } },
    })
  }

  findAcceptedMemberByUser(eventId: string, userId: string) {
    return this.prisma.eventMember.findFirst({
      where: { eventId, acceptedAt: { not: null }, userId },
    })
  }

  findAcceptedOrphanByEmail(eventId: string, email: string) {
    return this.prisma.eventMember.findFirst({
      where: {
        eventId,
        acceptedAt: { not: null },
        userId: null,
        email: { equals: email, mode: 'insensitive' },
      },
    })
  }

  linkMemberUser(memberId: string, userId: string) {
    return this.prisma.eventMember.update({
      where: { id: memberId },
      data: { userId },
    })
  }

  findSubGrant(eventMemberId: string, eventId: string) {
    return this.prisma.eventSubGrant.findUnique({
      where: { eventMemberId_eventId: { eventMemberId, eventId } },
    })
  }

  findChecklistConcealments(eventId: string, checklistId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { id: checklistId, eventId },
      select: { concealments: { select: { eventMemberId: true } } },
    })
  }

  findChecklistConcealmentsMany(eventId: string, checklistIds: string[]) {
    return this.prisma.eventChecklist.findMany({
      where: { id: { in: checklistIds }, eventId },
      select: { id: true, concealments: { select: { eventMemberId: true } } },
    })
  }

  findLiveEventParent(eventId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { id: true, parentId: true },
    })
  }

  findMembersByIds(eventId: string, memberIds: string[]) {
    return this.prisma.eventMember.findMany({
      where: { eventId, id: { in: memberIds } },
      select: { id: true },
    })
  }

  findSubGrantsForMembers(eventId: string, memberIds: string[]) {
    return this.prisma.eventSubGrant.findMany({
      where: { eventId, eventMemberId: { in: memberIds } },
      select: { eventMemberId: true },
    })
  }

  listHostedEventIds(userId: string) {
    return this.prisma.event.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    })
  }

  listMemberEventIds(userId: string) {
    return this.prisma.eventMember.findMany({
      where: { userId, acceptedAt: { not: null }, event: { deletedAt: null } },
      select: { eventId: true },
    })
  }

  listGrantedEventIds(userId: string) {
    return this.prisma.eventSubGrant.findMany({
      where: {
        member: {
          acceptedAt: { not: null },
          userId,
          event: { deletedAt: null },
        },
        event: { deletedAt: null },
      },
      select: { eventId: true },
    })
  }
}
