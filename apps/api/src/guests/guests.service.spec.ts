import { toPublicRsvp } from './guests.service'

describe('toPublicRsvp', () => {
  it('projects name, plus-one, and public event fields only', () => {
    const dto = toPublicRsvp({
      id: 'inv1',
      rsvpStatus: 'PENDING',
      rsvpAt: null,
      plusOneName: 'Ada',
      dietaryNote: 'Vegan',
      guestMessage: 'See you',
      guest: { firstName: 'Chioma', lastName: 'Okeke', plusOneAllowed: true },
      event: {
        id: 'evt1',
        title: 'Ada & Tunde',
        eventType: 'WEDDING',
        estimatedDate: new Date('2026-09-01'),
        location: 'Lagos',
      },
    })

    expect(dto).toEqual({
      id: 'inv1',
      rsvpStatus: 'PENDING',
      rsvpAt: null,
      plusOneName: 'Ada',
      dietaryNote: 'Vegan',
      guestMessage: 'See you',
      guest: { firstName: 'Chioma', lastName: 'Okeke', plusOneAllowed: true },
      event: {
        id: 'evt1',
        title: 'Ada & Tunde',
        eventType: 'WEDDING',
        estimatedDate: new Date('2026-09-01'),
        location: 'Lagos',
      },
    })
    expect(JSON.stringify(dto)).not.toMatch(/email|phone|"notes"/)
  })
})
