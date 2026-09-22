import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventActivityAction, EventSurface, VendorCategory } from '@prisma/client'
import { foldKey } from './event-helpers'
import { EventAccessService, type EventAccess } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { EventScheduleRepository } from './event-schedule.repository'
import type {
  CreateScheduleItemDto,
  ImportScheduleDto,
  UpdateScheduleItemDto,
} from './dto/schedule.dto'

@Injectable()
export class EventScheduleService {
  constructor(
    private repo: EventScheduleRepository,
    private access: EventAccessService,
    private activity: EventActivityService,
  ) {}

  async listSchedule(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.SCHEDULE,
      action: 'view',
    })
    const rows = await this.repo.listItems(eventId)
    return rows.map((item) => this.toScheduleDto(item, access))
  }

  async addScheduleItem(clerkId: string, eventId: string, dto: CreateScheduleItemDto) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.SCHEDULE,
      action: 'edit',
    })
    const budgetItemIds = this.uniqueIds(dto.budgetItemIds)
    const checklistItemIds = this.uniqueIds(dto.checklistItemIds)
    this.assertLinkSurfaces(access, budgetItemIds, checklistItemIds, dto.inspirationItemIds ?? [])
    await this.assertLinkedItems(access, eventId, budgetItemIds, checklistItemIds)
    const date = this.resolveScheduleDate(access.event, dto.date, { required: true })
    const last = await this.repo.lastSort(eventId)
    const created = await this.repo.createItem({
      eventId,
      title: dto.title.trim(),
      notes: this.emptyToNull(dto.notes),
      date,
      startTime: this.normalizeTime(dto.startTime),
      endTime: this.normalizeTime(dto.endTime),
      location: this.emptyToNull(dto.location),
      showOnSite: dto.showOnSite ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      budgetItemIds,
      checklistItemIds,
    })
    await this.syncScheduleInspirations(eventId, created.id, dto.inspirationItemIds ?? [])
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.CREATED,
      `Added schedule block “${created.title}”`,
      created.id,
    )
    return this.toScheduleDto(created, access)
  }

  async importScheduleItems(clerkId: string, eventId: string, dto: ImportScheduleDto) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.SCHEDULE,
      action: 'edit',
    })
    const existing = await this.repo.listImportKeys(eventId)
    const seen = new Set(
      existing.map((row) => `${foldKey(row.title)}|${row.date ?? ''}|${row.startTime ?? ''}`),
    )
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0)
    const fallbackDate =
      !access.event.parentId && access.event.estimatedDate
        ? access.event.estimatedDate.toISOString().slice(0, 10)
        : undefined
    const toCreate: {
      eventId: string
      title: string
      date: string | null
      startTime: string | null
      endTime: string | null
      location: string | null
      showOnSite: boolean
      sortOrder: number
    }[] = []
    let skipped = 0
    const rawItems = Array.isArray(dto.items) ? dto.items : []
    for (const raw of rawItems) {
      const title = typeof raw.title === 'string' ? raw.title.trim() : ''
      if (title.length < 2) {
        skipped += 1
        continue
      }
      let date: string | null = null
      if (!access.event.parentId) {
        date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date ?? '') ? raw.date! : (fallbackDate ?? null)
      }
      if (!access.event.parentId && !date) {
        skipped += 1
        continue
      }
      const startTime =
        typeof raw.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.startTime)
          ? raw.startTime
          : null
      const endTime =
        typeof raw.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.endTime)
          ? raw.endTime
          : null
      const key = `${foldKey(title)}|${date ?? ''}|${startTime ?? ''}`
      if (seen.has(key)) {
        skipped += 1
        continue
      }
      seen.add(key)
      sortOrder += 1
      toCreate.push({
        eventId,
        title,
        date,
        startTime,
        endTime,
        location:
          typeof raw.location === 'string' && raw.location.trim() ? raw.location.trim() : null,
        showOnSite: false,
        sortOrder,
      })
    }
    if (toCreate.length > 0) {
      await this.repo.createMany(toCreate)
      this.track(
        eventId,
        access.user.id,
        EventActivityAction.CREATED,
        `Imported ${toCreate.length} schedule block${toCreate.length === 1 ? '' : 's'}`,
      )
    }
    const items = await this.listSchedule(clerkId, eventId)
    return { created: toCreate.length, skipped, items, eventId }
  }

  async updateScheduleItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateScheduleItemDto,
  ) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.SCHEDULE,
      action: 'edit',
    })
    const existing = await this.repo.findItem(eventId, itemId)
    if (!existing) throw new NotFoundException('Schedule item not found')
    const budgetItemIds =
      dto.budgetItemIds === undefined ? undefined : this.uniqueIds(dto.budgetItemIds)
    const checklistItemIds =
      dto.checklistItemIds === undefined ? undefined : this.uniqueIds(dto.checklistItemIds)
    this.assertLinkSurfaces(
      access,
      budgetItemIds ?? [],
      checklistItemIds ?? [],
      dto.inspirationItemIds ?? [],
    )
    await this.assertLinkedItems(access, eventId, budgetItemIds ?? [], checklistItemIds ?? [])
    if (dto.date !== undefined) {
      this.resolveScheduleDate(access.event, dto.date, { required: true })
    }
    const updated = await this.repo.updateItem(itemId, {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.notes !== undefined && { notes: this.emptyToNull(dto.notes) }),
      ...(dto.date !== undefined && { date: this.normalizeDate(dto.date) }),
      ...(dto.startTime !== undefined && { startTime: this.normalizeTime(dto.startTime) }),
      ...(dto.endTime !== undefined && { endTime: this.normalizeTime(dto.endTime) }),
      ...(dto.location !== undefined && { location: this.emptyToNull(dto.location) }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.showOnSite !== undefined && { showOnSite: dto.showOnSite }),
      ...(budgetItemIds !== undefined && { budgetItemIds }),
      ...(checklistItemIds !== undefined && { checklistItemIds }),
    })
    if (dto.inspirationItemIds !== undefined) {
      await this.syncScheduleInspirations(eventId, itemId, dto.inspirationItemIds)
    }
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      `Updated schedule block “${updated.title}”`,
      updated.id,
    )
    return this.toScheduleDto(updated, access)
  }

  async deleteScheduleItem(clerkId: string, eventId: string, itemId: string) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.SCHEDULE,
      action: 'edit',
    })
    const existing = await this.repo.findItem(eventId, itemId)
    if (!existing) throw new NotFoundException('Schedule item not found')
    const deleted = await this.repo.deleteItem(itemId)
    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      `Removed schedule block “${existing.title}”`,
      itemId,
    )
    return deleted
  }

  toScheduleDto<
    T extends {
      budgetLinks: {
        budgetItem: {
          id: string
          label: string | null
          vendorName: string | null
          category: VendorCategory
          allocatedAmount: number
        }
      }[]
      checklistLinks: {
        checklistItem: {
          id: string
          title: string
          isCompleted: boolean
          concealments?: { eventMemberId: string }[]
        }
      }[]
    },
  >(item: T, access?: EventAccess) {
    const { budgetLinks, checklistLinks, ...rest } = item
    const showBudget = !access || this.access.canSee(access, EventSurface.BUDGET)
    const showChecklist = !access || this.access.canSee(access, EventSurface.CHECKLIST)
    return {
      ...rest,
      budgetItems: showBudget ? budgetLinks.map((link) => link.budgetItem) : [],
      checklistItems: showChecklist
        ? checklistLinks
            .filter(
              (link) =>
                !access || this.access.canSeeChecklistRow(access, link.checklistItem.concealments),
            )
            .map((link) => ({
              id: link.checklistItem.id,
              title: link.checklistItem.title,
              isCompleted: link.checklistItem.isCompleted,
            }))
        : [],
    }
  }

  private emptyToNull(value?: string | null) {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  }

  private normalizeTime(value?: string | null) {
    const v = this.emptyToNull(value)
    return v ? v.slice(0, 5) : null
  }

  private normalizeDate(value?: string | null) {
    const v = this.emptyToNull(value)
    return v ? v.slice(0, 10) : null
  }

  private resolveScheduleDate(
    event: { parentId: string | null },
    incoming: string | null | undefined,
    { required }: { required: boolean },
  ) {
    if (event.parentId) {
      if (incoming != null && String(incoming).trim() !== '') {
        throw new BadRequestException('Sub-event schedule blocks cannot have a date')
      }
      return null
    }
    const date = this.normalizeDate(incoming)
    if (required && !date) {
      throw new BadRequestException("Date is required on this event's schedule")
    }
    return date
  }

  private uniqueIds(ids?: string[]) {
    if (!ids) return []
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  }

  private assertLinkSurfaces(
    access: EventAccess,
    budgetItemIds: string[],
    checklistItemIds: string[],
    inspirationItemIds: string[] = [],
  ) {
    if (budgetItemIds.length > 0 && !this.access.canSee(access, EventSurface.BUDGET)) {
      throw new NotFoundException('Event not found')
    }
    if (checklistItemIds.length > 0 && !this.access.canSee(access, EventSurface.CHECKLIST)) {
      throw new NotFoundException('Event not found')
    }
    if (inspirationItemIds.length > 0 && !this.access.canSee(access, EventSurface.MOODBOARD)) {
      throw new NotFoundException('Event not found')
    }
  }

  private async assertLinkedItems(
    access: EventAccess,
    eventId: string,
    budgetItemIds: string[],
    checklistItemIds: string[],
  ) {
    if (budgetItemIds.length > 0) {
      const count = await this.repo.countBudgetItems(eventId, budgetItemIds)
      if (count !== budgetItemIds.length) {
        throw new NotFoundException('Budget item not found on this event')
      }
    }
    if (checklistItemIds.length > 0) {
      const count = await this.repo.countChecklistItems(eventId, checklistItemIds)
      if (count !== checklistItemIds.length) {
        throw new NotFoundException('Checklist item not found on this event')
      }
      const visible = await this.access.filterVisibleChecklistIds(access, checklistItemIds)
      if (visible.size !== checklistItemIds.length) {
        throw new NotFoundException('Checklist item not found on this event')
      }
    }
  }

  private async syncScheduleInspirations(
    eventId: string,
    scheduleItemId: string,
    inspirationItemIds: string[],
  ) {
    const ids = this.uniqueIds(inspirationItemIds)
    const moodItems = ids.length === 0 ? [] : await this.repo.findMoodBoardItems(eventId, ids)
    if (moodItems.length !== ids.length) {
      throw new NotFoundException('Inspiration is not saved to this event')
    }
    await this.repo.replaceMoodLinks(
      scheduleItemId,
      moodItems.map((item) => item.id),
    )
  }

  private track(
    eventId: string,
    actorId: string,
    action: EventActivityAction,
    summary: string,
    subjectId?: string,
  ) {
    void this.activity.log({
      eventId,
      actorId,
      action,
      surface: EventSurface.SCHEDULE,
      summary,
      subjectType: 'SCHEDULE_ITEM',
      subjectId,
    })
  }
}
