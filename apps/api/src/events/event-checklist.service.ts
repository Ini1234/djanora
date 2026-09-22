import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventActivityAction, EventSurface } from '@prisma/client'
import { asOptionalString, asRecord, foldKey } from './event-helpers'
import { EventAccessService } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { EventChecklistRepository, type ChecklistVendorInput } from './event-checklist.repository'
import type {
  CreateChecklistItemDto,
  ImportChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto'

@Injectable()
export class EventChecklistService {
  constructor(
    private repo: EventChecklistRepository,
    private access: EventAccessService,
    private activity: EventActivityService,
  ) {}

  async listChecklist(clerkId: string, eventId: string, assignedToMe = false) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.CHECKLIST,
      action: 'view',
    })
    const rows = await this.repo.listItems(eventId, assignedToMe ? access.user.id : undefined)
    return rows
      .filter((row) => this.access.canSeeChecklistRow(access, row.concealments))
      .map((row) =>
        this.toChecklistItemDto(
          row,
          access.isHost ? row.concealments.map((c) => c.eventMemberId) : [],
        ),
      )
  }

  async addChecklistItem(clerkId: string, eventId: string, dto: CreateChecklistItemDto) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.CHECKLIST,
      action: 'edit',
    })
    const last = await this.repo.lastSort(eventId)
    const dtoFields = asRecord(dto)
    const assigneeUserId = asOptionalString(dtoFields.assigneeUserId)
    if (assigneeUserId) await this.assertAssignee(eventId, assigneeUserId)
    const created = await this.repo.createItem({
      eventId,
      title: asOptionalString(dtoFields.title) ?? '',
      description: asOptionalString(dtoFields.description),
      dueDate: typeof dtoFields.dueDate === 'string' ? new Date(dtoFields.dueDate) : null,
      notifyByEmail: dtoFields.notifyByEmail === true,
      notifyBySms: dtoFields.notifyBySms === true,
      needsVendor: dtoFields.needsVendor === true,
      vendorCategory: asOptionalString(dtoFields.vendorCategory),
      assigneeUserId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })
    const vendors = this.vendorsFromDto(dto) ?? []
    if (vendors.length > 0) {
      await this.repo.replaceVendors(created.id, user.id, vendors)
    }
    this.track(
      eventId,
      user.id,
      EventActivityAction.CREATED,
      `Added checklist item “${created.title}”`,
      created.id,
    )
    const row = await this.repo.findWithVendors(created.id)
    return this.toChecklistItemDto(row)
  }

  async importChecklistItems(clerkId: string, eventId: string, dto: ImportChecklistDto) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.CHECKLIST,
      action: 'edit',
    })
    const existing = await this.repo.listTitles(eventId)
    const seen = new Set(existing.map((row) => foldKey(row.title)))
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0)
    const toCreate: {
      eventId: string
      title: string
      description: string | null
      dueDate: Date | null
      sortOrder: number
    }[] = []
    let skipped = 0
    const rawItems = Array.isArray(dto.items) ? dto.items : []
    for (const raw of rawItems) {
      const item = asRecord(raw)
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      if (title.length < 2) {
        skipped += 1
        continue
      }
      const key = foldKey(title)
      if (seen.has(key)) {
        skipped += 1
        continue
      }
      seen.add(key)
      sortOrder += 1
      const due =
        typeof item.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.dueDate)
          ? new Date(item.dueDate)
          : null
      toCreate.push({
        eventId,
        title,
        description: asOptionalString(item.description),
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        sortOrder,
      })
    }
    if (toCreate.length > 0) {
      await this.repo.createMany(toCreate)
      this.track(
        eventId,
        user.id,
        EventActivityAction.CREATED,
        `Imported ${toCreate.length} checklist item${toCreate.length === 1 ? '' : 's'}`,
      )
    }
    const items = await this.listChecklist(clerkId, eventId)
    return { created: toCreate.length, skipped, items }
  }

  async updateChecklistItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.CHECKLIST,
      action: 'edit',
    })
    const { user } = access
    await this.access.assertCanSeeChecklistItem(access, itemId)
    const existing = await this.repo.findItemId(eventId, itemId)
    if (!existing) throw new NotFoundException('Checklist item not found')

    if (dto.hiddenFromMemberIds !== undefined) {
      if (!access.isHost) {
        throw new ForbiddenException('Only the host can hide checklist rows')
      }
      await this.access.assertConcealmentTargets(eventId, dto.hiddenFromMemberIds)
    }

    if (dto.assigneeUserId !== undefined || dto.hiddenFromMemberIds !== undefined) {
      const assignee =
        dto.assigneeUserId !== undefined
          ? dto.assigneeUserId
          : ((await this.repo.findAssignee(itemId))?.assigneeUserId ?? null)
      await this.assertAssignee(eventId, assignee, dto.hiddenFromMemberIds, itemId)
    }

    const updated = await this.repo.updateItem(itemId, {
      ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        notifiedAt: null,
      }),
      ...(dto.notifyByEmail !== undefined && { notifyByEmail: dto.notifyByEmail }),
      ...(dto.notifyBySms !== undefined && { notifyBySms: dto.notifyBySms }),
      ...(dto.needsVendor !== undefined && { needsVendor: dto.needsVendor }),
      ...(dto.vendorCategory !== undefined && { vendorCategory: dto.vendorCategory }),
      ...(dto.assigneeUserId !== undefined && { assigneeUserId: dto.assigneeUserId }),
    })
    const vendors = this.vendorsFromDto(dto)
    if (vendors !== undefined) {
      await this.repo.replaceVendors(itemId, user.id, vendors)
    }
    if (dto.hiddenFromMemberIds !== undefined) {
      await this.repo.replaceConcealments(itemId, dto.hiddenFromMemberIds)
    }
    const homeSync: { title?: string; isCompleted?: boolean; dueDate?: Date | null } = {}
    if (dto.title !== undefined) homeSync.title = updated.title
    if (dto.isCompleted !== undefined) homeSync.isCompleted = updated.isCompleted
    if (dto.dueDate !== undefined) homeSync.dueDate = updated.dueDate
    if (Object.keys(homeSync).length > 0) {
      await this.repo.syncHomeChecklist(itemId, homeSync)
    }
    const action =
      dto.isCompleted === true && !existing.isCompleted
        ? EventActivityAction.COMPLETED
        : EventActivityAction.UPDATED
    this.track(
      eventId,
      user.id,
      action,
      action === EventActivityAction.COMPLETED
        ? `Completed “${updated.title}”`
        : `Updated checklist item “${updated.title}”`,
      updated.id,
    )
    const row = await this.repo.findWithConcealments(eventId, itemId)
    return this.toChecklistItemDto(
      row!,
      access.isHost ? (row?.concealments ?? []).map((c) => c.eventMemberId) : [],
    )
  }

  async deleteChecklistItem(clerkId: string, eventId: string, itemId: string) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.CHECKLIST,
      action: 'edit',
    })
    await this.access.assertCanSeeChecklistItem(access, itemId)
    const existing = await this.repo.findItemTitle(eventId, itemId)
    if (!existing) throw new NotFoundException('Checklist item not found')
    const deleted = await this.repo.deleteItem(itemId)
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.DELETED,
      `Removed checklist item “${existing.title}”`,
      itemId,
    )
    return deleted
  }

  toChecklistItemDto<
    T extends {
      vendors?: {
        id: string
        vendorProfileId: string | null
        userVendorContactId: string | null
        name: string | null
        sortOrder: number
        vendorProfile: {
          id: string
          businessName: string
          isVerified: boolean
          slug: string
        } | null
        userVendorContact: unknown
      }[]
      concealments?: { eventMemberId: string }[]
    },
  >(row: T, hiddenFromMemberIds: string[] = []) {
    const rest = { ...row }
    delete rest.concealments
    const vendors = row.vendors ?? []
    const mapped = vendors.map((vendor) => ({
      id: vendor.id,
      vendorProfileId: vendor.vendorProfileId,
      userVendorContactId: vendor.userVendorContactId,
      name:
        vendor.vendorProfile?.businessName ??
        (vendor.userVendorContact as { name?: string } | null)?.name ??
        vendor.name,
      vendorProfile: vendor.vendorProfile,
      userVendorContact: vendor.userVendorContact,
    }))
    const first = mapped[0] ?? null
    return {
      ...rest,
      vendors: mapped,
      vendorProfileId: first?.vendorProfileId ?? null,
      userVendorContactId: first?.userVendorContactId ?? null,
      vendorProfile: first?.vendorProfile ?? null,
      userVendorContact: first?.userVendorContact ?? null,
      hiddenFromMemberIds,
    }
  }

  private vendorsFromDto(dto: {
    vendors?: ChecklistVendorInput[]
    vendorProfileId?: string | null
    userVendorContactId?: string | null
    needsVendor?: boolean
  }): ChecklistVendorInput[] | undefined {
    if (dto.needsVendor === false) return []
    if (dto.vendors !== undefined) {
      const raw = Array.isArray(dto.vendors) ? dto.vendors : []
      return raw.map((entry) => {
        const rec = asRecord(entry)
        return {
          vendorProfileId: asOptionalString(rec.vendorProfileId),
          userVendorContactId: asOptionalString(rec.userVendorContactId),
          name: asOptionalString(rec.name),
        }
      })
    }
    if (dto.vendorProfileId !== undefined || dto.userVendorContactId !== undefined) {
      if (!dto.vendorProfileId && !dto.userVendorContactId) return []
      return [
        {
          vendorProfileId: dto.vendorProfileId ?? null,
          userVendorContactId: dto.userVendorContactId ?? null,
        },
      ]
    }
    return undefined
  }

  private async assertAssignee(
    eventId: string,
    assigneeUserId: string | null,
    hiddenFromMemberIds?: string[],
    checklistId?: string,
  ) {
    if (!assigneeUserId) return
    const event = await this.repo.findLiveEvent(eventId)
    if (!event) throw new NotFoundException('Event not found')
    const parentHost = event.parentId
      ? Boolean(await this.repo.findHostedParent(event.parentId, assigneeUserId))
      : false
    const isHost = event.userId === assigneeUserId || parentHost

    let memberId: string | null = null
    if (!isHost) {
      const direct = await this.repo.findAcceptedMember(eventId, assigneeUserId)
      if (direct?.surfaces.includes(EventSurface.CHECKLIST)) {
        memberId = direct.id
      } else if (event.parentId) {
        const parentMember = await this.repo.findAcceptedMember(event.parentId, assigneeUserId)
        const grant = parentMember ? await this.repo.findSubGrant(parentMember.id, eventId) : null
        if (!parentMember || !grant?.surfaces.includes(EventSurface.CHECKLIST)) {
          throw new BadRequestException('Assignee must already have Checklist on this event')
        }
        memberId = parentMember.id
      } else {
        throw new BadRequestException('Assignee must already have Checklist on this event')
      }
    }

    const hidden = new Set(hiddenFromMemberIds ?? [])
    if (checklistId && hiddenFromMemberIds === undefined) {
      const existing = await this.repo.listConcealmentMemberIds(checklistId)
      existing.forEach((row) => hidden.add(row.eventMemberId))
    }
    if (memberId && hidden.has(memberId)) {
      throw new BadRequestException('Cannot assign a hidden row to that person')
    }
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
      surface: EventSurface.CHECKLIST,
      summary,
      subjectType: 'CHECKLIST_ITEM',
      subjectId,
    })
  }
}
