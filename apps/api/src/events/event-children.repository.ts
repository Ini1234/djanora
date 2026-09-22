import { Injectable } from '@nestjs/common'
import { EventType, Tribe, WeddingTheme } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { defaultBudgetItems, defaultChecklist } from './event-defaults'

@Injectable()
export class EventChildrenRepository {
  constructor(private prisma: PrismaService) {}

  findParentTitle(parentId: string) {
    return this.prisma.event.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, title: true },
    })
  }

  listChildrenWithSpend(parentId: string) {
    return this.prisma.event.findMany({
      where: { parentId, deletedAt: null },
      orderBy: [{ estimatedDate: 'asc' }, { sortOrder: 'asc' }],
      include: { budgetItems: { select: { spentAmount: true } } },
    })
  }

  listGrants(eventMemberId: string, eventIds: string[]) {
    return this.prisma.eventSubGrant.findMany({
      where: { eventMemberId, eventId: { in: eventIds } },
    })
  }

  lastSort(parentId: string) {
    return this.prisma.event.findFirst({
      where: { parentId, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
  }

  createChild(data: {
    userId: string
    parentId: string
    title: string
    eventType: EventType
    tribes: Tribe[]
    themes: WeddingTheme[]
    estimatedDate: Date | null
    location: string
    guestCount: number | null
    totalBudget: number
    currency: string
    sortOrder: number
  }) {
    return this.prisma.event.create({
      data: {
        ...data,
        budgetItems: { create: defaultBudgetItems(data.totalBudget) },
        checklist: { create: defaultChecklist(data.tribes) },
      },
    })
  }

  listChildTypes(parentId: string) {
    return this.prisma.event.findMany({
      where: { parentId, deletedAt: null },
      select: { eventType: true },
    })
  }

  findLiveEvent(eventId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
  }

  countChildren(parentId: string) {
    return this.prisma.event.count({
      where: { parentId, deletedAt: null },
    })
  }

  attach(childId: string, parentId: string, sortOrder: number, currency: string) {
    return this.prisma.event.update({
      where: { id: childId },
      data: { parentId, sortOrder, currency },
    })
  }

  listChildrenByIds(parentId: string, eventIds: string[]) {
    return this.prisma.event.findMany({
      where: { parentId, deletedAt: null, id: { in: eventIds } },
      select: { id: true },
    })
  }

  reorder(eventIds: string[]) {
    return this.prisma.$transaction(
      eventIds.map((id, index) =>
        this.prisma.event.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
  }

  findChild(parentId: string, childId: string) {
    return this.prisma.event.findFirst({
      where: { id: childId, parentId, deletedAt: null },
    })
  }

  async detach(childId: string) {
    await this.prisma.eventSubGrant.deleteMany({ where: { eventId: childId } })
    return this.prisma.event.update({
      where: { id: childId },
      data: { parentId: null },
    })
  }
}
