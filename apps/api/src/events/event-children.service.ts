import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventActivityAction, EventSurface, Tribe, WeddingTheme } from '@prisma/client'
import { weekendHints } from '../assistant/assistant.weekend'
import { EventAccessService, type EventAccess } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { EventBudgetService } from './event-budget.service'
import { EventChecklistService } from './event-checklist.service'
import { EventChildrenRepository } from './event-children.repository'
import type {
  ApplyWeekendDto,
  AttachChildEventDto,
  CreateChildEventDto,
  ReorderChildrenDto,
} from './dto/children.dto'

@Injectable()
export class EventChildrenService {
  constructor(
    private repo: EventChildrenRepository,
    private access: EventAccessService,
    private activity: EventActivityService,
    private budget: EventBudgetService,
    private checklist: EventChecklistService,
  ) {}

  async projectTree(access: EventAccess) {
    const event = access.event
    const parent = event.parentId ? await this.repo.findParentTitle(event.parentId) : null
    if (event.parentId) {
      return { parent, children: [] as const, treeBudget: null }
    }

    const children = await this.repo.listChildrenWithSpend(event.id)
    const grants =
      !access.isHost && access.memberId
        ? await this.repo.listGrants(
            access.memberId,
            children.map((child) => child.id),
          )
        : []
    const grantByChild = new Map(grants.map((grant) => [grant.eventId, grant]))
    const visible = access.isHost
      ? children
      : children.filter((child) => grantByChild.has(child.id))

    const journey = visible.map((child) => ({
      id: child.id,
      title: child.title,
      eventType: child.eventType,
      tribes: child.tribes,
      estimatedDate: child.estimatedDate,
      location: child.location,
      sortOrder: child.sortOrder,
      isCompleted: child.isCompleted,
      allocatedBudget:
        this.access.canSee(access, EventSurface.BUDGET) ||
        grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET)
          ? child.totalBudget
          : undefined,
      spentAmount:
        this.access.canSee(access, EventSurface.BUDGET) ||
        grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET)
          ? child.budgetItems.reduce((sum, item) => sum + item.spentAmount, 0)
          : undefined,
    }))

    const budgetChildren = visible.filter(
      (child) =>
        access.isHost ||
        this.access.canSee(access, EventSurface.BUDGET) ||
        Boolean(grantByChild.get(child.id)?.surfaces.includes(EventSurface.BUDGET)),
    )

    return {
      parent,
      children: journey,
      treeBudget:
        children.length === 0
          ? null
          : {
              pot: this.access.canSee(access, EventSurface.BUDGET) ? event.totalBudget : 0,
              envelopesTotal: budgetChildren.reduce((sum, child) => sum + child.totalBudget, 0),
              spentTotal: budgetChildren.reduce(
                (sum, child) =>
                  sum + child.budgetItems.reduce((acc, item) => acc + item.spentAmount, 0),
                0,
              ),
            },
    }
  }

  async addChild(clerkId: string, parentId: string, dto: CreateChildEventDto) {
    const { user, event: parent } = await this.requireParentHost(clerkId, parentId)
    const envelope = dto.allocatedBudget ?? 0
    const last = await this.repo.lastSort(parentId)
    const created = await this.repo.createChild({
      userId: parent.userId,
      parentId,
      title: dto.title,
      eventType: dto.eventType,
      tribes: dto.tribes,
      themes: dto.themes,
      estimatedDate: dto.estimatedDate ? new Date(dto.estimatedDate) : null,
      location: dto.location,
      guestCount: dto.guestCount ?? null,
      totalBudget: envelope,
      currency: parent.currency,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })
    this.track(parentId, user.id, `Added sub-event “${created.title}”`, created.id)
    return created
  }

  async applyWeekend(clerkId: string, parentId: string, dto: ApplyWeekendDto) {
    const { event: parent } = await this.requireParentHost(clerkId, parentId)
    const tribes = parent.tribes.length ? parent.tribes : [Tribe.OTHER]
    const themes = parent.themes.length ? parent.themes : [WeddingTheme.FUSION]
    const location = parent.location?.trim() || 'To be confirmed'
    const existing = await this.repo.listChildTypes(parentId)
    const seen = new Set(existing.map((row) => row.eventType))
    let skipped = 0
    let created = 0
    for (const ceremony of dto.ceremonies) {
      if (seen.has(ceremony.eventType)) {
        skipped += 1
        continue
      }
      seen.add(ceremony.eventType)
      await this.addChild(clerkId, parentId, {
        title: ceremony.title,
        eventType: ceremony.eventType,
        tribes,
        themes,
        location,
        estimatedDate: ceremony.estimatedDate,
        guestCount: parent.guestCount ?? undefined,
        allocatedBudget: 0,
      })
      created += 1
    }
    const hints = weekendHints(
      tribes,
      dto.ceremonies.map((row) => ({
        eventType: row.eventType,
        title: row.title,
        estimatedDate: row.estimatedDate,
      })),
    )
    if (hints.checklist.length) {
      await this.checklist.importChecklistItems(clerkId, parentId, { items: hints.checklist })
    }
    if (hints.budget.length) {
      await this.budget.importBudgetItems(clerkId, parentId, { items: hints.budget })
    }
    return { created, skipped, eventId: parentId }
  }

  async attachChild(clerkId: string, parentId: string, dto: AttachChildEventDto) {
    const { user, event: parent } = await this.requireParentHost(clerkId, parentId)
    const child = await this.repo.findLiveEvent(dto.eventId)
    if (!child || child.userId !== user.id) throw new NotFoundException('Event not found')
    if (child.id === parentId) throw new BadRequestException('An event cannot contain itself')
    if (child.parentId) throw new BadRequestException('That event already belongs to another event')
    const nested = await this.repo.countChildren(child.id)
    if (nested > 0) throw new BadRequestException('Sub-events cannot have their own sub-events')
    const last = await this.repo.lastSort(parentId)
    await this.repo.attach(child.id, parentId, (last?.sortOrder ?? 0) + 1, parent.currency)
  }

  async reorderChildren(clerkId: string, parentId: string, dto: ReorderChildrenDto) {
    await this.requireParentHost(clerkId, parentId)
    const children = await this.repo.listChildrenByIds(parentId, dto.eventIds)
    if (children.length !== dto.eventIds.length) {
      throw new BadRequestException('Can only reorder sub-events of this event')
    }
    await this.repo.reorder(dto.eventIds)
  }

  async detachChild(clerkId: string, parentId: string, childId: string) {
    await this.requireParentHost(clerkId, parentId)
    const child = await this.repo.findChild(parentId, childId)
    if (!child) throw new NotFoundException('Event not found')
    await this.repo.detach(childId)
  }

  private async requireParentHost(clerkId: string, parentId: string) {
    const access = await this.access.require(clerkId, parentId, { action: 'host' })
    if (access.event.parentId) {
      throw new BadRequestException('Sub-events cannot have their own sub-events')
    }
    return access
  }

  private track(eventId: string, actorId: string, summary: string, subjectId: string) {
    void this.activity.log({
      eventId,
      actorId,
      action: EventActivityAction.CREATED,
      surface: EventSurface.SCHEDULE,
      summary,
      subjectType: 'EVENT',
      subjectId,
    })
  }
}
