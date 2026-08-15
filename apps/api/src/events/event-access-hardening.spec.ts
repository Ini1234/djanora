import { BadRequestException, NotFoundException } from '@nestjs/common'
import { EventMemberRole, EventSurface, InspirationCategory } from '@prisma/client'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { escapeHtml } from '../common/escape-html'
import { toPublicRsvp } from '../guests/guests.service'
import { EmbeddingService } from '../inspiration/embedding.service'
import { CreateInspirationDto } from '../inspiration/dto/create-inspiration.dto'
import { InspirationService } from '../inspiration/inspiration.service'
import { CompleteOnboardingDto } from '../users/dto/complete-onboarding.dto'
import { UsersService } from '../users/users.service'
import {
  allowsAction,
  EventAccessService,
  type EventAccess,
} from './event-access.service'
import { EventMembersService } from './event-members.service'
import { receiptProxyUrl, rewriteReceiptUrls } from './events.service'

/**
 * Contract tests for docs/specs/event-access-hardening.md.
 * If a new feature weakens concealment, public DTOs, admin gates, or receipt auth, these fail.
 */

const memberAccess = {
  isHost: false,
  memberId: 'm1',
  role: EventMemberRole.EDITOR,
  surfaces: [EventSurface.CHECKLIST],
  event: { id: 'evt1' },
  user: { id: 'u1' },
} as EventAccess

const hostAccess = {
  isHost: true,
  memberId: undefined,
  role: 'HOST' as const,
  surfaces: [EventSurface.CHECKLIST],
  event: { id: 'evt1' },
  user: { id: 'host' },
} as EventAccess

const scheduleOnlyEditor = {
  isHost: false,
  role: EventMemberRole.EDITOR,
  surfaces: [EventSurface.SCHEDULE],
}

describe('hardening: concealment row ACL (FR-1–FR-7)', () => {
  it('host always sees a concealed row; the target member does not', () => {
    const svc = new EventAccessService({} as any)
    const hidden = [{ eventMemberId: 'm1' }]
    expect(svc.canSeeChecklistRow(hostAccess, hidden)).toBe(true)
    expect(svc.canSeeChecklistRow(memberAccess, hidden)).toBe(false)
  })

  it('assertCanSeeChecklistItem 404s on a concealed or unknown row', async () => {
    const prisma = {
      eventChecklist: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ concealments: [{ eventMemberId: 'm1' }] })
          .mockResolvedValueOnce(null),
      },
    }
    const svc = new EventAccessService(prisma as any)
    await expect(svc.assertCanSeeChecklistItem(memberAccess, 'hidden-row'))
      .rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.assertCanSeeChecklistItem(memberAccess, 'missing'))
      .rejects.toMatchObject({ message: 'Event not found' })
  })

  it('filterVisibleChecklistIds omits concealed ids and keeps visible ones', async () => {
    const prisma = {
      eventChecklist: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'hidden', concealments: [{ eventMemberId: 'm1' }] },
          { id: 'visible', concealments: [] },
        ]),
      },
    }
    const svc = new EventAccessService(prisma as any)
    const visible = await svc.filterVisibleChecklistIds(memberAccess, ['hidden', 'visible'])
    expect([...visible]).toEqual(['visible'])
  })

  it('filterVisibleChecklistIds does not hide rows from the host', async () => {
    const svc = new EventAccessService({} as any)
    const visible = await svc.filterVisibleChecklistIds(hostAccess, ['hidden', 'visible'])
    expect(visible).toEqual(new Set(['hidden', 'visible']))
  })
})

describe('hardening: host-only hide list (FR-8, FR-9)', () => {
  it('rejects foreign member ids as concealment targets', async () => {
    const prisma = {
      event: { findFirst: jest.fn().mockResolvedValue({ id: 'evt1', parentId: null }) },
      eventMember: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const svc = new EventAccessService(prisma as any)
    await expect(svc.assertConcealmentTargets('evt1', ['stranger']))
      .rejects.toBeInstanceOf(BadRequestException)
  })

  it('accepts a direct member of this event', async () => {
    const prisma = {
      event: { findFirst: jest.fn().mockResolvedValue({ id: 'evt1', parentId: null }) },
      eventMember: { findMany: jest.fn().mockResolvedValue([{ id: 'm1' }]) },
    }
    const svc = new EventAccessService(prisma as any)
    await expect(svc.assertConcealmentTargets('evt1', ['m1'])).resolves.toBeUndefined()
  })
})

describe('hardening: home checklist requires Checklist edit (FR-10, FR-11)', () => {
  it('denies Checklist edit for a Schedule-only editor', () => {
    expect(allowsAction(scheduleOnlyEditor, 'edit', EventSurface.CHECKLIST)).toBe(false)
  })

  it('createChecklist asks for Checklist edit and does not write if denied', async () => {
    const access = {
      require: jest.fn().mockRejectedValue(new NotFoundException('Event not found')),
    }
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      $transaction: jest.fn(),
    }
    const svc = new UsersService(prisma as any, {} as any, access as any)

    await expect(
      svc.createChecklist('clerk_1', { title: 'Book DJ', dueDate: '2026-09-01', eventId: 'evt1' }),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(access.require).toHaveBeenCalledWith('clerk_1', 'evt1', {
      surface: EventSurface.CHECKLIST,
      action: 'edit',
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('skips event-row sync when the personal item is concealed', async () => {
    const eventUpdate = jest.fn()
    const access = {
      require: jest.fn(),
      load: jest.fn().mockResolvedValue(memberAccess),
      canSeeChecklistItem: jest.fn().mockResolvedValue(false),
    }
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      userChecklist: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          title: 'Book DJ',
          dueDate: null,
          isCompleted: false,
          eventId: 'evt1',
          eventChecklistId: 'ec1',
        }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn({
        eventChecklist: { update: eventUpdate },
        userChecklist: {
          update: jest.fn().mockResolvedValue({
            id: 'p1',
            title: 'Book DJ',
            isCompleted: true,
            dueDate: null,
            eventId: 'evt1',
            eventChecklistId: 'ec1',
            createdAt: new Date(),
            updatedAt: new Date(),
            event: { id: 'evt1', title: 'Wedding' },
          }),
        },
      })),
    }
    const svc = new UsersService(prisma as any, {} as any, access as any)
    await svc.updateChecklist('clerk_1', 'p1', { isCompleted: true })
    expect(eventUpdate).not.toHaveBeenCalled()
  })
})

describe('hardening: public RSVP and invites (FR-12, FR-14)', () => {
  it('RSVP projection never includes email, phone, or event.notes', () => {
    const dto = toPublicRsvp({
      id: 'inv1',
      rsvpStatus: 'PENDING',
      rsvpAt: null,
      plusOneName: null,
      dietaryNote: null,
      guestMessage: null,
      guest: { firstName: 'Ada', lastName: null, plusOneAllowed: false },
      event: {
        id: 'evt1',
        title: 'Wedding',
        eventType: 'WEDDING',
        estimatedDate: null,
        location: 'Lagos',
      },
    })
    const keys = JSON.stringify(dto)
    expect(keys).not.toMatch(/email|phone|"notes"/)
    expect(dto.event).toEqual({
      id: 'evt1',
      title: 'Wedding',
      eventType: 'WEDDING',
      estimatedDate: null,
      location: 'Lagos',
    })
    expect(Object.keys(dto.guest).sort()).toEqual(['firstName', 'lastName', 'plusOneAllowed'])
  })

  it('accepted planner invite returns title only', async () => {
    const prisma = {
      eventMember: {
        findUnique: jest.fn().mockResolvedValue({
          acceptedAt: new Date('2026-08-01'),
          role: EventMemberRole.EDITOR,
          surfaces: [EventSurface.BUDGET, EventSurface.CHECKLIST],
          invitedBy: { firstName: 'Host', lastName: 'Person' },
          event: { title: 'Ada & Tunde', eventType: 'WEDDING', estimatedDate: null, deletedAt: null },
        }),
      },
    }
    const svc = new EventMembersService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
    const preview = await svc.previewByToken('tok')
    expect(preview).toEqual({ accepted: true, event: { title: 'Ada & Tunde' } })
    expect(preview).not.toHaveProperty('surfaces')
    expect(preview).not.toHaveProperty('role')
    expect(preview).not.toHaveProperty('invitedBy')
  })
})

describe('hardening: members childGrants (FR-22)', () => {
  function membersService(access: { isHost: boolean }, grants: { eventId: string; surfaces: EventSurface[] }[]) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'host',
          firstName: 'H',
          lastName: 'Ost',
          email: 'h@x.com',
          avatarUrl: null,
        }),
      },
      eventMember: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'm1',
          email: 'm@x.com',
          role: EventMemberRole.EDITOR,
          surfaces: [EventSurface.CHECKLIST],
          subGrants: grants,
          acceptedAt: new Date(),
          createdAt: new Date(),
          token: 'tok',
          user: { id: 'u2', firstName: 'M', lastName: 'Em', email: 'm@x.com', avatarUrl: null },
        }]),
      },
    }
    const accessSvc = {
      require: jest.fn().mockResolvedValue({
        isHost: access.isHost,
        event: { userId: 'host', createdAt: new Date() },
      }),
    }
    const svc = new EventMembersService(
      prisma as any,
      accessSvc as any,
      {} as any,
      {} as any,
      {} as any,
      { get: () => 'http://localhost:3000' } as any,
      {} as any,
    )
    return svc
  }

  const grants = [{ eventId: 'child1', surfaces: [EventSurface.BUDGET] }]

  it('strips childGrants for a non-host', async () => {
    const listed = await membersService({ isHost: false }, grants).list('clerk', 'evt1')
    expect(listed.members[0].childGrants).toEqual([])
  })

  it('keeps childGrants for the host', async () => {
    const listed = await membersService({ isHost: true }, grants).list('clerk', 'evt1')
    expect(listed.members[0].childGrants).toEqual(grants)
  })
})

describe('hardening: admin, onboarding, inspiration (FR-15–FR-17)', () => {
  it('onboarding DTO rejects ADMIN', async () => {
    const dto = plainToInstance(CompleteOnboardingDto, { role: 'ADMIN' })
    const errors = await validate(dto)
    expect(errors.some((error) => error.property === 'role')).toBe(true)
  })

  it('create-inspiration DTO rejects isAdminCurated', async () => {
    const dto = Object.assign(new CreateInspirationDto(), {
      title: 'Look',
      description: 'A look',
      category: InspirationCategory.DECOR,
      isAdminCurated: true,
    })
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true })
    expect(errors.some((error) => error.property === 'isAdminCurated')).toBe(true)
  })

  it('create always stores isAdminCurated false', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'i1' })
    const svc = new InspirationService(
      {
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
        inspirationItem: { create },
      } as any,
      { embedDocument: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
      {} as any,
    )
    await svc.create('clerk', {
      title: 'Look',
      description: 'A look',
      category: InspirationCategory.DECOR,
      isAdminCurated: true,
    } as any)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isAdminCurated: false }),
    }))
  })
})

describe('hardening: embed prefixes (FR-18)', () => {
  it('prefixes search as Query: and stored text as Document:', async () => {
    const svc = new EmbeddingService({ get: () => undefined } as any)
    const embed = jest.spyOn(svc, 'embed').mockResolvedValue(null)
    await svc.embedQuery('aso oke')
    await svc.embedDocument('title description tags')
    expect(embed).toHaveBeenCalledWith('Query: aso oke')
    expect(embed).toHaveBeenCalledWith('Document: title description tags')
  })
})

describe('hardening: receipts stay off public /uploads (FR-19)', () => {
  it('rewrites every receipt url through the authenticated proxy', () => {
    const rewritten = rewriteReceiptUrls('evt1', [{
      id: 'item1',
      receipts: [
        { id: 'r1', url: 'http://localhost:3001/uploads/receipt-old.jpg' },
        { id: 'r2', url: 'private/abc.pdf' },
      ],
    }])
    expect(rewritten[0].receipts?.map((row) => row.url)).toEqual([
      receiptProxyUrl('evt1', 'item1', 'r1'),
      receiptProxyUrl('evt1', 'item1', 'r2'),
    ])
    for (const url of rewritten[0].receipts ?? []) {
      expect(url.url).toMatch(/^\/api\/proxy\/events\/evt1\/budget\/item1\/receipts\/.+\/file$/)
      expect(url.url).not.toMatch(/\/uploads\//)
    }
  })
})

describe('hardening: invite HTML escape (FR-21)', () => {
  it('escapes markup in guest-facing strings', () => {
    expect(escapeHtml('<script>alert(1)</script> & "x"')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;',
    )
  })
})
