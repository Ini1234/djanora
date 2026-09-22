import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export const SCHEDULE_INCLUDE = {
  budgetLinks: {
    include: {
      budgetItem: {
        select: { id: true, label: true, vendorName: true, category: true, allocatedAmount: true },
      },
    },
  },
  checklistLinks: {
    include: {
      checklistItem: {
        select: {
          id: true,
          title: true,
          isCompleted: true,
          concealments: { select: { eventMemberId: true } },
        },
      },
    },
  },
} as const

@Injectable()
export class EventScheduleRepository {
  constructor(private prisma: PrismaService) {}

  listItems(eventId: string) {
    return this.prisma.eventScheduleItem.findMany({
      where: { eventId },
      orderBy: [{ startTime: 'asc' }, { sortOrder: 'asc' }],
      include: SCHEDULE_INCLUDE,
    })
  }

  lastSort(eventId: string) {
    return this.prisma.eventScheduleItem.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
    })
  }

  createItem(data: {
    eventId: string
    title: string
    notes: string | null
    date: string | null
    startTime: string | null
    endTime: string | null
    location: string | null
    showOnSite: boolean
    sortOrder: number
    budgetItemIds: string[]
    checklistItemIds: string[]
  }) {
    return this.prisma.eventScheduleItem.create({
      data: {
        eventId: data.eventId,
        title: data.title,
        notes: data.notes,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        showOnSite: data.showOnSite,
        sortOrder: data.sortOrder,
        budgetLinks: {
          create: data.budgetItemIds.map((budgetItemId) => ({ budgetItemId })),
        },
        checklistLinks: {
          create: data.checklistItemIds.map((checklistItemId) => ({ checklistItemId })),
        },
      },
      include: SCHEDULE_INCLUDE,
    })
  }

  listImportKeys(eventId: string) {
    return this.prisma.eventScheduleItem.findMany({
      where: { eventId },
      select: { title: true, date: true, startTime: true, sortOrder: true },
    })
  }

  createMany(
    data: {
      eventId: string
      title: string
      date: string | null
      startTime: string | null
      endTime: string | null
      location: string | null
      showOnSite: boolean
      sortOrder: number
    }[],
  ) {
    return this.prisma.eventScheduleItem.createMany({ data })
  }

  findItem(eventId: string, itemId: string) {
    return this.prisma.eventScheduleItem.findFirst({
      where: { id: itemId, eventId },
    })
  }

  updateItem(
    itemId: string,
    data: {
      title?: string
      notes?: string | null
      date?: string | null
      startTime?: string | null
      endTime?: string | null
      location?: string | null
      sortOrder?: number
      showOnSite?: boolean
      budgetItemIds?: string[]
      checklistItemIds?: string[]
    },
  ) {
    return this.prisma.eventScheduleItem.update({
      where: { id: itemId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.showOnSite !== undefined && { showOnSite: data.showOnSite }),
        ...(data.budgetItemIds !== undefined && {
          budgetLinks: {
            deleteMany: {},
            create: data.budgetItemIds.map((budgetItemId) => ({ budgetItemId })),
          },
        }),
        ...(data.checklistItemIds !== undefined && {
          checklistLinks: {
            deleteMany: {},
            create: data.checklistItemIds.map((checklistItemId) => ({ checklistItemId })),
          },
        }),
      },
      include: SCHEDULE_INCLUDE,
    })
  }

  deleteItem(itemId: string) {
    return this.prisma.eventScheduleItem.delete({ where: { id: itemId } })
  }

  countBudgetItems(eventId: string, ids: string[]) {
    return this.prisma.eventBudgetItem.count({
      where: { eventId, id: { in: ids } },
    })
  }

  countChecklistItems(eventId: string, ids: string[]) {
    return this.prisma.eventChecklist.count({
      where: { eventId, id: { in: ids } },
    })
  }

  findMoodBoardItems(eventId: string, inspirationItemIds: string[]) {
    return this.prisma.moodBoardItem.findMany({
      where: { eventId, inspirationItemId: { in: inspirationItemIds } },
      select: { id: true },
    })
  }

  async replaceMoodLinks(scheduleItemId: string, moodBoardItemIds: string[]) {
    await this.prisma.eventScheduleMoodBoardLink.deleteMany({ where: { scheduleItemId } })
    if (moodBoardItemIds.length === 0) return
    await this.prisma.eventScheduleMoodBoardLink.createMany({
      data: moodBoardItemIds.map((moodBoardItemId) => ({ scheduleItemId, moodBoardItemId })),
    })
  }
}
