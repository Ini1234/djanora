import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { foldKey } from './event-helpers'

export type ChecklistVendorInput = {
  vendorProfileId?: string | null
  userVendorContactId?: string | null
  name?: string | null
}

export const CHECKLIST_VENDOR_INCLUDE = {
  orderBy: { sortOrder: 'asc' as const },
  include: {
    userVendorContact: true,
    vendorProfile: { select: { id: true, businessName: true, isVerified: true, slug: true } },
  },
} as const

export const CHECKLIST_ITEM_INCLUDE = {
  vendors: CHECKLIST_VENDOR_INCLUDE,
  assignee: { select: { id: true, firstName: true, lastName: true } },
} as const

@Injectable()
export class EventChecklistRepository {
  constructor(private prisma: PrismaService) {}

  listItems(eventId: string, assigneeUserId?: string) {
    return this.prisma.eventChecklist.findMany({
      where: {
        eventId,
        ...(assigneeUserId ? { assigneeUserId } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        ...CHECKLIST_ITEM_INCLUDE,
        concealments: { select: { eventMemberId: true } },
      },
    })
  }

  lastSort(eventId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
    })
  }

  createItem(data: {
    eventId: string
    title: string
    description: string | null
    dueDate: Date | null
    notifyByEmail: boolean
    notifyBySms: boolean
    needsVendor: boolean
    vendorCategory: string | null
    assigneeUserId: string | null
    sortOrder: number
  }) {
    return this.prisma.eventChecklist.create({
      data,
      include: CHECKLIST_ITEM_INCLUDE,
    })
  }

  findWithVendors(id: string) {
    return this.prisma.eventChecklist.findUniqueOrThrow({
      where: { id },
      include: CHECKLIST_ITEM_INCLUDE,
    })
  }

  findWithConcealments(eventId: string, itemId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { id: itemId, eventId },
      include: {
        ...CHECKLIST_ITEM_INCLUDE,
        concealments: { select: { eventMemberId: true } },
      },
    })
  }

  listTitles(eventId: string) {
    return this.prisma.eventChecklist.findMany({
      where: { eventId },
      select: { title: true, sortOrder: true },
    })
  }

  createMany(
    data: {
      eventId: string
      title: string
      description: string | null
      dueDate: Date | null
      sortOrder: number
    }[],
  ) {
    return this.prisma.eventChecklist.createMany({ data })
  }

  findItemId(eventId: string, itemId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, isCompleted: true },
    })
  }

  findAssignee(itemId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { id: itemId },
      select: { assigneeUserId: true },
    })
  }

  updateItem(
    itemId: string,
    data: {
      isCompleted?: boolean
      title?: string
      description?: string | null
      dueDate?: Date | null
      notifiedAt?: Date | null
      notifyByEmail?: boolean
      notifyBySms?: boolean
      needsVendor?: boolean
      vendorCategory?: string | null
      assigneeUserId?: string | null
    },
  ) {
    return this.prisma.eventChecklist.update({
      where: { id: itemId },
      data,
      include: CHECKLIST_ITEM_INCLUDE,
    })
  }

  async replaceConcealments(itemId: string, memberIds: string[]) {
    await this.prisma.eventChecklistConcealment.deleteMany({ where: { checklistId: itemId } })
    if (memberIds.length === 0) return
    await this.prisma.eventChecklistConcealment.createMany({
      data: memberIds.map((eventMemberId) => ({ checklistId: itemId, eventMemberId })),
    })
  }

  syncHomeChecklist(
    itemId: string,
    data: { title?: string; isCompleted?: boolean; dueDate?: Date | null },
  ) {
    return this.prisma.userChecklist.updateMany({
      where: { eventChecklistId: itemId },
      data,
    })
  }

  findItemTitle(eventId: string, itemId: string) {
    return this.prisma.eventChecklist.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, title: true },
    })
  }

  async deleteItem(itemId: string) {
    await this.prisma.userChecklist.deleteMany({ where: { eventChecklistId: itemId } })
    return this.prisma.eventChecklist.delete({ where: { id: itemId } })
  }

  listConcealmentMemberIds(checklistId: string) {
    return this.prisma.eventChecklistConcealment.findMany({
      where: { checklistId },
      select: { eventMemberId: true },
    })
  }

  findLiveEvent(eventId: string) {
    return this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
    })
  }

  findHostedParent(parentId: string, userId: string) {
    return this.prisma.event.findFirst({
      where: { id: parentId, userId, deletedAt: null },
      select: { id: true },
    })
  }

  findAcceptedMember(eventId: string, userId: string) {
    return this.prisma.eventMember.findFirst({
      where: { eventId, userId, acceptedAt: { not: null } },
    })
  }

  findSubGrant(eventMemberId: string, eventId: string) {
    return this.prisma.eventSubGrant.findUnique({
      where: { eventMemberId_eventId: { eventMemberId, eventId } },
    })
  }

  async replaceVendors(checklistId: string, userId: string, vendors: ChecklistVendorInput[]) {
    const profileIds = [
      ...new Set(
        vendors.map((row) => row.vendorProfileId).filter((id): id is string => Boolean(id)),
      ),
    ]
    const contactIds = [
      ...new Set(
        vendors.map((row) => row.userVendorContactId).filter((id): id is string => Boolean(id)),
      ),
    ]
    const [profiles, contacts] = await Promise.all([
      profileIds.length
        ? this.prisma.vendorProfile.findMany({
            where: { id: { in: profileIds } },
            select: { id: true, businessName: true },
          })
        : Promise.resolve([] as { id: string; businessName: string }[]),
      contactIds.length
        ? this.prisma.userVendorContact.findMany({
            where: { id: { in: contactIds }, userId },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
    ])
    const profileById = new Map(profiles.map((row) => [row.id, row] as const))
    const contactById = new Map(contacts.map((row) => [row.id, row] as const))

    const cleaned: {
      vendorProfileId: string | null
      userVendorContactId: string | null
      name: string | null
      sortOrder: number
    }[] = []
    const seen = new Set<string>()
    for (const vendor of vendors) {
      let vendorProfileId = vendor.vendorProfileId ?? null
      let userVendorContactId = vendor.userVendorContactId ?? null
      let name = vendor.name?.trim() || null
      if (vendorProfileId) {
        const profile = profileById.get(vendorProfileId)
        if (!profile) continue
        vendorProfileId = profile.id
        name = profile.businessName
      } else if (userVendorContactId) {
        const contact = contactById.get(userVendorContactId)
        if (!contact) continue
        userVendorContactId = contact.id
        name = contact.name
      }
      if (!vendorProfileId && !userVendorContactId && !name) continue
      let key = `n:${foldKey(name)}`
      if (vendorProfileId) key = `p:${vendorProfileId}`
      else if (userVendorContactId) key = `c:${userVendorContactId}`
      if (seen.has(key)) continue
      seen.add(key)
      cleaned.push({ vendorProfileId, userVendorContactId, name, sortOrder: cleaned.length })
    }

    const store = this.vendorStore()
    await store.deleteMany({ where: { checklistId } })
    const primary = cleaned[0]
    await this.prisma.eventChecklist.update({
      where: { id: checklistId },
      data: {
        vendorProfileId: primary?.vendorProfileId ?? null,
        userVendorContactId: primary?.userVendorContactId ?? null,
      },
    })
    if (cleaned.length === 0) return
    await store.createMany({
      data: cleaned.map((row) => ({ checklistId, ...row })),
    })
  }

  private vendorStore() {
    const store: unknown = Reflect.get(this.prisma, 'eventChecklistVendor')
    return store as {
      deleteMany: (args: { where: { checklistId: string } }) => Promise<unknown>
      createMany: (args: {
        data: Array<{
          checklistId: string
          vendorProfileId: string | null
          userVendorContactId: string | null
          name: string | null
          sortOrder: number
        }>
      }) => Promise<unknown>
    }
  }
}
