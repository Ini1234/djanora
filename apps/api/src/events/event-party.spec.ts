import { EventPartySide, EventPartyStatus } from '@prisma/client'
import {
  buildPointedBy,
  hostPartyDtos,
  partnerIdOf,
  publicPartyDtos,
  type PartyRow,
} from './event-party.helpers'

function row(partial: Partial<PartyRow> & Pick<PartyRow, 'id'>): PartyRow {
  return {
    eventId: 'e1',
    name: partial.name ?? partial.id,
    role: '',
    side: EventPartySide.OTHER,
    group: null,
    bio: null,
    sortOrder: 0,
    showOnSite: false,
    status: EventPartyStatus.PENDING,
    pairedWithId: null,
    photoKey: null,
    ...partial,
  }
}

describe('wedding party pairing', () => {
  it('resolves the partner from either side of the FK', () => {
    const rows = [row({ id: 'ada', pairedWithId: 'chidi' }), row({ id: 'chidi' })]
    const pointedBy = buildPointedBy(rows)
    expect(partnerIdOf(rows[0], pointedBy)).toBe('chidi')
    expect(partnerIdOf(rows[1], pointedBy)).toBe('ada')
  })
})

describe('wedding party public redaction', () => {
  it('omits hidden members and never leaks status', () => {
    const rows = [
      row({
        id: 'ada',
        name: 'Ada',
        role: 'Maid of Honor',
        side: EventPartySide.BRIDE,
        showOnSite: true,
        status: EventPartyStatus.CONFIRMED,
        pairedWithId: 'chidi',
      }),
      row({
        id: 'chidi',
        name: 'Chidi',
        role: 'Best Man',
        side: EventPartySide.GROOM,
        showOnSite: true,
        status: EventPartyStatus.PENDING,
      }),
      row({
        id: 'hidden',
        name: 'Hidden',
        showOnSite: false,
        status: EventPartyStatus.CONFIRMED,
      }),
    ]
    const guests = publicPartyDtos(rows)
    expect(guests.map((person) => person.id)).toEqual(['ada', 'chidi'])
    expect(guests[0].pairedWithId).toBe('chidi')
    expect(guests[1].pairedWithId).toBe('ada')
    expect(JSON.stringify(guests)).not.toContain('CONFIRMED')
    expect(JSON.stringify(guests)).not.toContain('PENDING')
    expect(JSON.stringify(guests)).not.toContain('status')

    const host = hostPartyDtos(rows)
    expect(host).toHaveLength(3)
    expect(host[0].status).toBe('CONFIRMED')
    expect(host[2].showOnSite).toBe(false)
  })
})
