import { EventSiteStatus } from '@prisma/client'
import { NotFoundException } from '@nestjs/common'
import { GuestsService, toPublicRsvp } from './guests.service'

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

describe('unlockLink', () => {
  it('creates an invite without sending and returns the live site url', async () => {
    const prisma = {
      guest: {
        findFirst: jest.fn().mockResolvedValue({ id: 'g1', eventId: 'e1', invite: null }),
      },
      guestInvite: {
        create: jest.fn().mockResolvedValue({ token: 'abc123' }),
      },
      event: {
        findUnique: jest.fn().mockResolvedValue({
          site: { slug: 'amaka-kemi', status: EventSiteStatus.PUBLISHED },
          parent: null,
        }),
      },
    }
    const service = new GuestsService(
      prisma as never,
      {} as never,
      { get: jest.fn().mockReturnValue('https://djanora.com') } as never,
      { require: jest.fn().mockResolvedValue({}) } as never,
      {} as never,
    )
    await expect(service.unlockLink('clerk', 'e1', 'g1')).resolves.toEqual({
      url: 'https://djanora.com/e/amaka-kemi?inviteeId=abc123',
      code: 'abc123',
    })
    expect(prisma.guestInvite.create).toHaveBeenCalled()
  })
})

describe('token RSVP', () => {
  it('hides invites for a soft-deleted event', async () => {
    const prisma = {
      guestInvite: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inv1',
          expiresAt: null,
          event: { id: 'e1', deletedAt: new Date() },
          guest: { firstName: 'Ada', lastName: null, plusOneAllowed: false },
        }),
      },
    }
    const service = new GuestsService(
      prisma as never,
      {} as never,
      { get: jest.fn() } as never,
      { require: jest.fn() } as never,
      {} as never,
    )
    await expect(service.getInviteByToken('tok')).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.submitRsvp('tok', { status: 'ATTENDING' } as never),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})
