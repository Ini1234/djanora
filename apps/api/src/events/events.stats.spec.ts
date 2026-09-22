import { RsvpStatus } from '@prisma/client'
import { EventsService } from './events.service'

describe('event stats guest counts', () => {
  it('counts RSVP ATTENDING as confirmed, not names on the guest list', async () => {
    const access = {
      isHost: true,
      role: 'HOST',
      surfaces: [],
      event: { id: 'evt1', parentId: null },
      user: { id: 'u1' },
    }

    const guestInviteCount = jest.fn().mockResolvedValue(2)
    const guestCount = jest.fn().mockResolvedValue(5)
    const prisma = {
      event: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'evt1',
          title: 'Wedding',
          totalBudget: 0,
          parentId: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      eventBudgetItem: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { spentAmount: 0 } }),
      },
      eventChecklist: { count: jest.fn().mockResolvedValue(0) },
      eventScheduleItem: { count: jest.fn().mockResolvedValue(0) },
      guestInvite: { count: guestInviteCount },
      guest: { count: guestCount },
    }
    const accessSvc = {
      require: jest.fn().mockResolvedValue(access),
      canSee: jest.fn().mockReturnValue(true),
    }
    const activity = { recordOpen: jest.fn() }
    const children = {
      projectTree: jest.fn().mockResolvedValue({ parent: null, children: [], treeBudget: null }),
    }
    const svc = new EventsService(
      prisma as any,
      accessSvc as any,
      activity as any,
      children as any,
      {} as any,
      {} as any,
      {} as any,
    )

    const result = await svc.findById('clerk1', 'evt1')

    expect(guestInviteCount).toHaveBeenCalledWith({
      where: { eventId: 'evt1', rsvpStatus: RsvpStatus.ATTENDING },
    })
    expect(guestCount).toHaveBeenCalledWith({ where: { eventId: 'evt1' } })
    expect(result?.stats).toMatchObject({
      confirmedGuestCount: 2,
      guestListCount: 5,
    })
  })
})
