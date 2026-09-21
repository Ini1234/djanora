import { EventPartySide, EventPartyStatus, EventSiteSectionType, Prisma } from '@prisma/client'
import { rewriteAppUploadUrl } from '../uploads/public-upload-url'
import { sanitizePeople, sanitizePlainText } from '../event-sites/event-site.constants'
import type { PrismaService } from '../prisma/prisma.service'

export const MAX_PARTY_MEMBERS = 40

export type PartyRow = {
  id: string
  eventId: string
  name: string
  role: string
  side: EventPartySide
  group: string | null
  bio: string | null
  sortOrder: number
  showOnSite: boolean
  status: EventPartyStatus
  pairedWithId: string | null
  photoKey: string | null
}

export function buildPointedBy(rows: { id: string; pairedWithId: string | null }[]) {
  const map = new Map<string, string>()
  for (const row of rows) {
    if (row.pairedWithId) map.set(row.pairedWithId, row.id)
  }
  return map
}

export function partnerIdOf(
  row: { id: string; pairedWithId: string | null },
  pointedBy: Map<string, string>,
) {
  return row.pairedWithId ?? pointedBy.get(row.id) ?? null
}

export function toPartyDto(row: PartyRow, pairedWithId: string | null) {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    role: row.role,
    side: row.side,
    group: row.group,
    bio: row.bio,
    sortOrder: row.sortOrder,
    showOnSite: row.showOnSite,
    status: row.status,
    pairedWithId,
    photoUrl: row.photoKey ? rewriteAppUploadUrl(`uploads/${row.photoKey}`) : null,
  }
}

export function toSitePerson(row: PartyRow, pairedWithId: string | null) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    side: row.side,
    group: row.group ?? '',
    bio: row.bio ?? '',
    pairedWithId,
    image: row.photoKey
      ? { id: row.id, url: rewriteAppUploadUrl(`uploads/${row.photoKey}`) ?? '', alt: row.name }
      : undefined,
  }
}

export function publicPartyDtos(rows: PartyRow[]) {
  const pointedBy = buildPointedBy(rows)
  return rows
    .filter((row) => row.showOnSite)
    .map((row) => toSitePerson(row, partnerIdOf(row, pointedBy)))
}

export function hostPartyDtos(rows: PartyRow[]) {
  const pointedBy = buildPointedBy(rows)
  return rows.map((row) => toPartyDto(row, partnerIdOf(row, pointedBy)))
}

function payloadOf(section?: { payload: Prisma.JsonValue } | null) {
  if (!section?.payload || typeof section.payload !== 'object' || Array.isArray(section.payload)) {
    return {}
  }
  return section.payload as Record<string, unknown>
}

export async function importLegacyParty(prisma: PrismaService, eventId: string) {
  const count = await prisma.eventPartyMember.count({ where: { eventId } })
  if (count > 0) return

  const site = await prisma.eventSite.findUnique({
    where: { eventId },
    include: { sections: true, photos: true },
  })
  const section = site?.sections.find((row) => row.type === EventSiteSectionType.PEOPLE)
  const people = sanitizePeople(payloadOf(section).people as never)
  if (people.length === 0) return

  const photos = (site?.photos ?? []).filter((photo) => photo.personId)
  await prisma.eventPartyMember.createMany({
    data: people.map((person, i) => ({
      id: person.id,
      eventId,
      name: person.name || 'Guest',
      role: person.role,
      group: person.group || null,
      bio: person.bio || null,
      sortOrder: i,
      showOnSite: true,
      photoKey: photos.find((photo) => photo.personId === person.id)?.filename ?? null,
    })),
  })
}

function partyText(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function clipPartyName(value: unknown) {
  return sanitizePlainText(partyText(value), 80).trim()
}

export function clipPartyRole(value: unknown) {
  return sanitizePlainText(partyText(value), 80)
}

export function clipPartyGroup(value: unknown) {
  const text = sanitizePlainText(partyText(value), 40).trim()
  return text || null
}

export function clipPartyBio(value: unknown) {
  const text = sanitizePlainText(partyText(value), 400).trim()
  return text || null
}
