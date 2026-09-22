import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EventActivityAction, EventSurface, RsvpStatus } from '@prisma/client'
import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import {
  ApplyWeekendDto,
  AttachChildEventDto,
  CreateChildEventDto,
  ReorderChildrenDto,
} from './dto/children.dto'
import {
  CreateChecklistItemDto,
  ImportChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto'
import { CreateBudgetItemDto, UpdateBudgetItemDto, ImportBudgetDto } from './dto/budget.dto'
import { CreateScheduleItemDto, ImportScheduleDto, UpdateScheduleItemDto } from './dto/schedule.dto'
import { defaultBudgetItems, defaultChecklist } from './event-defaults'
import {
  EventAccessService,
  ALL_SURFACES,
  viewerDto,
  type EventAccess,
} from './event-access.service'
import { EventActivityService, OPENED_SURFACE } from './event-activity.service'
import { EventBudgetService } from './event-budget.service'
import { EventChecklistService } from './event-checklist.service'
import { EventChildrenService } from './event-children.service'
import { EventScheduleService } from './event-schedule.service'
import { importLegacyParty } from './event-party.helpers'
import { liveUserWhere } from '../common/active-user'

export { receiptProxyUrl, rewriteReceiptUrls } from './event-receipts'

const EVENT_SHELL_INCLUDE = {
  parent: { select: { id: true, title: true } },
  site: { select: { slug: true, status: true } },
} as const

const LIST_EVENT_INCLUDE = {
  parent: { select: { id: true, title: true } },
} as const

function recencyMs(
  event: { id: string; createdAt: Date; updatedAt?: Date },
  openedAt: Map<string, number>,
) {
  const updated = (event.updatedAt ?? event.createdAt).getTime()
  return Math.max(updated, openedAt.get(event.id) ?? 0)
}

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private activity: EventActivityService,
    private children: EventChildrenService,
    private budget: EventBudgetService,
    private checklist: EventChecklistService,
    private schedule: EventScheduleService,
  ) {}

  async create(clerkId: string, dto: CreateEventDto) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')

    const seedBudget = dto.includeDefaultBudget === true
    const seedChecklist = dto.includeDefaultChecklist === true

    const event = await this.prisma.event.create({
      data: {
        userId: user.id,
        title: dto.title,
        eventType: dto.eventType,
        tribes: dto.tribes,
        themes: dto.themes,
        totalBudget: dto.totalBudget,
        estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
        guestCount: dto.guestCount ?? null,
        location: dto.location ?? 'Ottawa, Ontario, Canada',
        ...(seedBudget && {
          budgetItems: {
            create: defaultBudgetItems(dto.totalBudget),
          },
        }),
        ...(seedChecklist && {
          checklist: {
            create: defaultChecklist(dto.tribes),
          },
        }),
      },
      include: {
        budgetItems: true,
        checklist: true,
        schedule: true,
      },
    })

    return {
      ...event,
      viewer: { isHost: true as const, role: 'HOST' as const, surfaces: [...ALL_SURFACES] },
    }
  }

  async findById(clerkId: string, eventId: string, assignedToMe = false) {
    const access = await this.access.require(clerkId, eventId)
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: EVENT_SHELL_INCLUDE,
    })
    if (!event) return event
    void this.activity.recordOpen(access.user.id, eventId)
    const [tree, stats] = await Promise.all([
      this.children.projectTree(access),
      this.eventStats(eventId, access, assignedToMe),
    ])
    return {
      ...this.projectShell(event, access),
      stats,
      ...tree,
    }
  }

  async updateEvent(clerkId: string, eventId: string, dto: UpdateEventDto) {
    await this.access.require(clerkId, eventId, { action: 'host' })

    if (dto.partyEnabled === true) {
      await importLegacyParty(this.prisma, eventId)
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.estimatedDate !== undefined && {
          estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
        }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.guestCount !== undefined && { guestCount: dto.guestCount }),
        ...(dto.totalBudget !== undefined && { totalBudget: dto.totalBudget }),
        ...(dto.partyEnabled !== undefined && { partyEnabled: dto.partyEnabled }),
      },
    })
  }

  async softDelete(clerkId: string, eventId: string) {
    const { user, event } = await this.access.require(clerkId, eventId, { action: 'host' })
    const childIds = event.parentId
      ? []
      : (
          await this.prisma.event.findMany({
            where: { parentId: eventId, deletedAt: null },
            select: { id: true },
          })
        ).map((child) => child.id)

    await this.prisma.event.updateMany({
      where: { id: { in: [eventId, ...childIds] }, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    void this.activity.log({
      eventId,
      actorId: user.id,
      action: EventActivityAction.DELETED,
      surface: EventSurface.SCHEDULE,
      summary: `Deleted “${event.title}”`,
      subjectType: 'EVENT',
      subjectId: eventId,
    })
    return { ok: true as const }
  }

  async findByUser(clerkId: string) {
    const user = await this.prisma.user.findFirst({ where: liveUserWhere(clerkId) })
    if (!user) throw new NotFoundException('User not found')

    const listInclude = LIST_EVENT_INCLUDE

    const [hosted, memberships, grants] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId: user.id, deletedAt: null },
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.eventMember.findMany({
        where: { userId: user.id, acceptedAt: { not: null }, event: { deletedAt: null } },
        include: { event: { include: listInclude } },
      }),
      this.prisma.eventSubGrant.findMany({
        where: {
          member: {
            acceptedAt: { not: null },
            userId: user.id,
            event: { deletedAt: null },
          },
          event: { deletedAt: null },
        },
        include: {
          event: { include: listInclude },
          member: { select: { id: true, role: true } },
        },
      }),
    ])

    const hostedIds = new Set(hosted.map((e) => e.id))
    const hostedProjected = hosted.map((event) =>
      this.projectShell(event, {
        user,
        event,
        isHost: true,
        role: 'HOST',
        surfaces: [...ALL_SURFACES],
      }),
    )
    const seen = new Set(hostedIds)
    const memberProjected = memberships
      .filter((m) => !seen.has(m.eventId))
      .map((m) => {
        seen.add(m.eventId)
        return this.projectShell(m.event, {
          user,
          event: m.event,
          isHost: false,
          role: m.role,
          surfaces: m.surfaces,
          memberId: m.id,
        })
      })
    const grantProjected = grants
      .filter((g) => !seen.has(g.eventId))
      .map((g) =>
        this.projectShell(g.event, {
          user,
          event: g.event,
          isHost: false,
          role: g.member.role,
          surfaces: g.surfaces,
          memberId: g.member.id,
        }),
      )

    const combined = [...hostedProjected, ...memberProjected, ...grantProjected]
    const opened = await this.prisma.eventSurfaceRead.findMany({
      where: {
        userId: user.id,
        surface: OPENED_SURFACE,
        eventId: { in: combined.map((e) => e.id) },
      },
      select: { eventId: true, seenAt: true },
    })
    const openedAt = new Map(opened.map((row) => [row.eventId, row.seenAt.getTime()]))
    return combined.sort((a, b) => recencyMs(b, openedAt) - recencyMs(a, openedAt))
  }

  listBudget(clerkId: string, eventId: string) {
    return this.budget.listBudget(clerkId, eventId)
  }

  addBudgetItem(clerkId: string, eventId: string, dto: CreateBudgetItemDto) {
    return this.budget.addBudgetItem(clerkId, eventId, dto)
  }

  importBudgetItems(clerkId: string, eventId: string, dto: ImportBudgetDto) {
    return this.budget.importBudgetItems(clerkId, eventId, dto)
  }

  updateBudgetItem(clerkId: string, eventId: string, itemId: string, dto: UpdateBudgetItemDto) {
    return this.budget.updateBudgetItem(clerkId, eventId, itemId, dto)
  }

  deleteBudgetItem(clerkId: string, eventId: string, itemId: string) {
    return this.budget.deleteBudgetItem(clerkId, eventId, itemId)
  }

  addReceipt(
    clerkId: string,
    eventId: string,
    itemId: string,
    filename: string,
    url: string,
    mimeType?: string,
    fileSize?: number,
  ) {
    return this.budget.addReceipt(clerkId, eventId, itemId, filename, url, mimeType, fileSize)
  }

  openReceiptFile(clerkId: string, eventId: string, itemId: string, receiptId: string) {
    return this.budget.openReceiptFile(clerkId, eventId, itemId, receiptId)
  }

  deleteReceipt(clerkId: string, eventId: string, receiptId: string) {
    return this.budget.deleteReceipt(clerkId, eventId, receiptId)
  }

  listChecklist(clerkId: string, eventId: string, assignedToMe = false) {
    return this.checklist.listChecklist(clerkId, eventId, assignedToMe)
  }

  addChecklistItem(clerkId: string, eventId: string, dto: CreateChecklistItemDto) {
    return this.checklist.addChecklistItem(clerkId, eventId, dto)
  }

  importChecklistItems(clerkId: string, eventId: string, dto: ImportChecklistDto) {
    return this.checklist.importChecklistItems(clerkId, eventId, dto)
  }

  updateChecklistItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    return this.checklist.updateChecklistItem(clerkId, eventId, itemId, dto)
  }

  deleteChecklistItem(clerkId: string, eventId: string, itemId: string) {
    return this.checklist.deleteChecklistItem(clerkId, eventId, itemId)
  }

  listSchedule(clerkId: string, eventId: string) {
    return this.schedule.listSchedule(clerkId, eventId)
  }

  addScheduleItem(clerkId: string, eventId: string, dto: CreateScheduleItemDto) {
    return this.schedule.addScheduleItem(clerkId, eventId, dto)
  }

  importScheduleItems(clerkId: string, eventId: string, dto: ImportScheduleDto) {
    return this.schedule.importScheduleItems(clerkId, eventId, dto)
  }

  updateScheduleItem(clerkId: string, eventId: string, itemId: string, dto: UpdateScheduleItemDto) {
    return this.schedule.updateScheduleItem(clerkId, eventId, itemId, dto)
  }

  deleteScheduleItem(clerkId: string, eventId: string, itemId: string) {
    return this.schedule.deleteScheduleItem(clerkId, eventId, itemId)
  }

  async addChild(clerkId: string, parentId: string, dto: CreateChildEventDto) {
    await this.children.addChild(clerkId, parentId, dto)
    return this.findById(clerkId, parentId)
  }

  async applyWeekend(clerkId: string, parentId: string, dto: ApplyWeekendDto) {
    const result = await this.children.applyWeekend(clerkId, parentId, dto)
    return { ...result, event: await this.findById(clerkId, parentId) }
  }

  async attachChild(clerkId: string, parentId: string, dto: AttachChildEventDto) {
    await this.children.attachChild(clerkId, parentId, dto)
    return this.findById(clerkId, parentId)
  }

  async reorderChildren(clerkId: string, parentId: string, dto: ReorderChildrenDto) {
    await this.children.reorderChildren(clerkId, parentId, dto)
    return this.findById(clerkId, parentId)
  }

  async detachChild(clerkId: string, parentId: string, childId: string) {
    await this.children.detachChild(clerkId, parentId, childId)
    return this.findById(clerkId, parentId)
  }

  private projectShell<T extends { totalBudget: number }>(event: T, access: EventAccess) {
    return {
      ...event,
      totalBudget: this.access.canSee(access, EventSurface.BUDGET) ? event.totalBudget : 0,
      viewer: viewerDto(access),
    }
  }

  private async eventStats(eventId: string, access: EventAccess, assignedToMe = false) {
    const showBudget = this.access.canSee(access, EventSurface.BUDGET)
    const showChecklist = this.access.canSee(access, EventSurface.CHECKLIST)
    const showSchedule = this.access.canSee(access, EventSurface.SCHEDULE)
    const showGuests = access.isHost || this.access.canSee(access, EventSurface.GUESTS)
    const checklistWhere = {
      eventId,
      ...(assignedToMe ? { assigneeUserId: access.user.id } : {}),
    }

    const [
      spent,
      checklistDone,
      checklistTotal,
      scheduleCount,
      confirmedGuestCount,
      guestListCount,
    ] = await Promise.all([
      showBudget
        ? this.prisma.eventBudgetItem.aggregate({
            where: { eventId },
            _sum: { spentAmount: true },
          })
        : Promise.resolve({ _sum: { spentAmount: null as number | null } }),
      showChecklist
        ? this.prisma.eventChecklist.count({ where: { ...checklistWhere, isCompleted: true } })
        : Promise.resolve(0),
      showChecklist
        ? this.prisma.eventChecklist.count({ where: checklistWhere })
        : Promise.resolve(0),
      showSchedule
        ? this.prisma.eventScheduleItem.count({ where: { eventId } })
        : Promise.resolve(0),
      showGuests
        ? this.prisma.guestInvite.count({
            where: { eventId, rsvpStatus: RsvpStatus.ATTENDING },
          })
        : Promise.resolve(0),
      showGuests ? this.prisma.guest.count({ where: { eventId } }) : Promise.resolve(0),
    ])

    return {
      spentTotal: spent._sum.spentAmount ?? 0,
      checklistDone,
      checklistTotal,
      scheduleCount,
      confirmedGuestCount,
      guestListCount,
    }
  }
}
