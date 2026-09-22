import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { EventActivityAction, EventPartySide, EventPartyStatus, EventSurface } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { BlobStorageService } from '../uploads/blob-storage.service'
import { EventAccessService } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import {
  MAX_PARTY_MEMBERS,
  clipPartyBio,
  clipPartyGroup,
  clipPartyName,
  clipPartyRole,
  hostPartyDtos,
  importLegacyParty,
  publicPartyDtos,
  type PartyRow,
} from './event-party.helpers'
import type { CreatePartyMemberDto, ImportPartyDto, UpdatePartyMemberDto } from './dto/party.dto'

@Injectable()
export class EventPartyService {
  constructor(
    private prisma: PrismaService,
    private access: EventAccessService,
    private activity: EventActivityService,
    private storage: BlobStorageService,
  ) {}

  async list(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.PARTY,
      action: 'view',
    })
    await importLegacyParty(this.prisma, eventId)
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { partyEnabled: true },
    })
    const members = await this.rows(eventId)
    return {
      enabled: event?.partyEnabled === true,
      members: hostPartyDtos(members),
      canEdit: access.isHost || access.role === 'EDITOR',
    }
  }

  async add(clerkId: string, eventId: string, dto: CreatePartyMemberDto) {
    const access = await this.requireEnabledEdit(clerkId, eventId)
    const count = await this.prisma.eventPartyMember.count({ where: { eventId } })
    if (count >= MAX_PARTY_MEMBERS) {
      throw new BadRequestException(`Wedding party is limited to ${MAX_PARTY_MEMBERS} people`)
    }
    const name = clipPartyName(dto.name)
    if (!name) throw new BadRequestException('Name is required')
    const last = await this.prisma.eventPartyMember.findFirst({
      where: { eventId },
      orderBy: { sortOrder: 'desc' },
    })
    const created = await this.prisma.eventPartyMember.create({
      data: {
        eventId,
        name,
        role: clipPartyRole(dto.role),
        side: dto.side ?? EventPartySide.OTHER,
        group: clipPartyGroup(dto.group),
        bio: clipPartyBio(dto.bio),
        showOnSite: dto.showOnSite === true,
        status: dto.status ?? EventPartyStatus.PENDING,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    })
    if (dto.pairedWithId) {
      await this.setPair(eventId, created.id, dto.pairedWithId)
    }
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.CREATED,
      `Added “${created.name}” to the wedding party`,
      created.id,
    )
    return this.list(clerkId, eventId)
  }

  async importMembers(clerkId: string, eventId: string, dto: ImportPartyDto) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.PARTY,
      action: 'edit',
    })
    await this.prisma.event.update({
      where: { id: eventId },
      data: { partyEnabled: true },
    })
    await importLegacyParty(this.prisma, eventId)
    const existing = await this.prisma.eventPartyMember.findMany({
      where: { eventId },
      select: { name: true, sortOrder: true },
    })
    const seen = new Set(existing.map((row) => row.name.trim().toLowerCase()))
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0)
    const room = Math.max(0, MAX_PARTY_MEMBERS - existing.length)
    const toCreate: {
      eventId: string
      name: string
      role: string
      side: EventPartySide
      showOnSite: boolean
      status: EventPartyStatus
      sortOrder: number
    }[] = []
    let skipped = 0
    const members = Array.isArray(dto.members) ? dto.members : []
    for (const raw of members) {
      const name = clipPartyName(raw.name)
      if (!name) {
        skipped += 1
        continue
      }
      const key = name.toLowerCase()
      if (seen.has(key)) {
        skipped += 1
        continue
      }
      if (toCreate.length >= room) {
        skipped += 1
        continue
      }
      seen.add(key)
      sortOrder += 1
      toCreate.push({
        eventId,
        name,
        role: clipPartyRole(raw.role),
        side: raw.side ?? EventPartySide.OTHER,
        showOnSite: false,
        status: EventPartyStatus.PENDING,
        sortOrder,
      })
    }
    if (toCreate.length > 0) {
      await this.prisma.eventPartyMember.createMany({ data: toCreate })
      this.track(
        eventId,
        access.user.id,
        EventActivityAction.CREATED,
        `Imported ${toCreate.length} wedding party member${toCreate.length === 1 ? '' : 's'}`,
        eventId,
      )
    }
    const roster = await this.list(clerkId, eventId)
    return { created: toCreate.length, skipped, eventId, ...roster }
  }

  async update(clerkId: string, eventId: string, memberId: string, dto: UpdatePartyMemberDto) {
    const access = this.isShowOnSiteOnly(dto)
      ? await this.requireSiteOrPartyEdit(clerkId, eventId)
      : await this.requireEnabledEdit(clerkId, eventId)
    const existing = await this.mustMember(eventId, memberId)
    const name = dto.name !== undefined ? clipPartyName(dto.name) : existing.name
    if (!name) throw new BadRequestException('Name is required')
    await this.prisma.eventPartyMember.update({
      where: { id: memberId },
      data: {
        name,
        ...(dto.role !== undefined && { role: clipPartyRole(dto.role) }),
        ...(dto.side !== undefined && { side: dto.side }),
        ...(dto.group !== undefined && { group: clipPartyGroup(dto.group) }),
        ...(dto.bio !== undefined && { bio: clipPartyBio(dto.bio) }),
        ...(dto.showOnSite !== undefined && { showOnSite: dto.showOnSite }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    })
    if (dto.pairedWithId !== undefined) {
      if (dto.pairedWithId) await this.setPair(eventId, memberId, dto.pairedWithId)
      else await this.clearPair(eventId, memberId)
    }
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      `Updated “${name}” in the wedding party`,
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async remove(clerkId: string, eventId: string, memberId: string) {
    const access = await this.requireEnabledEdit(clerkId, eventId)
    const existing = await this.mustMember(eventId, memberId)
    await this.clearPair(eventId, memberId)
    await this.prisma.eventPartyMember.delete({ where: { id: memberId } })
    if (existing.photoKey) {
      await this.storage.delete('images', existing.photoKey).catch(() => undefined)
    }
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.DELETED,
      `Removed “${existing.name}” from the wedding party`,
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async pair(clerkId: string, eventId: string, memberId: string, partnerId: string) {
    const access = await this.requireEnabledEdit(clerkId, eventId)
    await this.setPair(eventId, memberId, partnerId)
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      'Matched wedding party members',
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async unpair(clerkId: string, eventId: string, memberId: string) {
    const access = await this.requireEnabledEdit(clerkId, eventId)
    await this.mustMember(eventId, memberId)
    await this.clearPair(eventId, memberId)
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      'Unmatched a wedding party pair',
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async setPhoto(clerkId: string, eventId: string, memberId: string, filename: string) {
    const access = await this.requireSiteOrPartyEdit(clerkId, eventId)
    const existing = await this.mustMember(eventId, memberId)
    if (existing.photoKey) {
      await this.storage.delete('images', existing.photoKey).catch(() => undefined)
    }
    await this.prisma.eventPartyMember.update({
      where: { id: memberId },
      data: { photoKey: filename },
    })
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      `Updated photo for “${existing.name}”`,
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async deletePhoto(clerkId: string, eventId: string, memberId: string) {
    const access = await this.requireSiteOrPartyEdit(clerkId, eventId)
    const existing = await this.mustMember(eventId, memberId)
    if (existing.photoKey) {
      await this.storage.delete('images', existing.photoKey).catch(() => undefined)
    }
    await this.prisma.eventPartyMember.update({
      where: { id: memberId },
      data: { photoKey: null },
    })
    this.track(
      eventId,
      access.user.id,
      EventActivityAction.UPDATED,
      `Removed photo for “${existing.name}”`,
      memberId,
    )
    return this.list(clerkId, eventId)
  }

  async liveForSite(eventId: string) {
    await importLegacyParty(this.prisma, eventId)
    const members = await this.rows(eventId)
    return publicPartyDtos(members)
  }

  async hostForSite(eventId: string) {
    await importLegacyParty(this.prisma, eventId)
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { partyEnabled: true },
    })
    const members = await this.rows(eventId)
    return { enabled: event?.partyEnabled === true, members: hostPartyDtos(members) }
  }

  private isShowOnSiteOnly(dto: UpdatePartyMemberDto) {
    return (
      dto.showOnSite !== undefined &&
      dto.name === undefined &&
      dto.role === undefined &&
      dto.side === undefined &&
      dto.group === undefined &&
      dto.bio === undefined &&
      dto.status === undefined &&
      dto.sortOrder === undefined &&
      dto.pairedWithId === undefined
    )
  }

  private async requireSiteOrPartyEdit(clerkId: string, eventId: string) {
    try {
      return await this.access.requireSite(clerkId, eventId)
    } catch {
      return this.requireEnabledEdit(clerkId, eventId)
    }
  }

  private async requireEnabledEdit(clerkId: string, eventId: string) {
    const access = await this.access.require(clerkId, eventId, {
      surface: EventSurface.PARTY,
      action: 'edit',
    })
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { partyEnabled: true },
    })
    if (!event?.partyEnabled) {
      throw new BadRequestException('Add wedding party to this event first')
    }
    return access
  }

  private async mustMember(eventId: string, memberId: string) {
    const row = await this.prisma.eventPartyMember.findFirst({ where: { id: memberId, eventId } })
    if (!row) throw new NotFoundException('Event not found')
    return row
  }

  private async rows(eventId: string): Promise<PartyRow[]> {
    return this.prisma.eventPartyMember.findMany({
      where: { eventId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  }

  private async setPair(eventId: string, memberId: string, partnerId: string) {
    if (memberId === partnerId) {
      throw new BadRequestException('A person cannot be paired with themselves')
    }
    const [member, partner] = await Promise.all([
      this.prisma.eventPartyMember.findFirst({ where: { id: memberId, eventId } }),
      this.prisma.eventPartyMember.findFirst({ where: { id: partnerId, eventId } }),
    ])
    if (!member || !partner) {
      throw new BadRequestException('Both people must be on this event')
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.eventPartyMember.updateMany({
        where: {
          eventId,
          OR: [
            { pairedWithId: memberId },
            { pairedWithId: partnerId },
            { id: { in: [memberId, partnerId] } },
          ],
        },
        data: { pairedWithId: null },
      })
      await tx.eventPartyMember.update({
        where: { id: memberId },
        data: { pairedWithId: partnerId },
      })
    })
  }

  private async clearPair(eventId: string, memberId: string) {
    await this.prisma.eventPartyMember.updateMany({
      where: { eventId, OR: [{ id: memberId }, { pairedWithId: memberId }] },
      data: { pairedWithId: null },
    })
  }

  private track(
    eventId: string,
    actorId: string,
    action: EventActivityAction,
    summary: string,
    subjectId: string,
  ) {
    void this.activity.log({
      eventId,
      actorId,
      action,
      surface: EventSurface.PARTY,
      summary,
      subjectType: 'PARTY_MEMBER',
      subjectId,
    })
  }
}
