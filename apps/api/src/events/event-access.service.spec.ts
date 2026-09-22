import { EventMemberRole, EventSurface } from '@prisma/client'
import { EventAccessRepository } from './event-access.repository'
import {
  allowsAction,
  EventAccessService,
  memberCanComment,
  memberCanEdit,
  memberCanSee,
  roleAllowsComment,
  roleAllowsEdit,
} from './event-access.service'
import type { EventAccess } from './event-access.service'

function accessService(prisma: unknown) {
  return new EventAccessService(new EventAccessRepository(prisma as never))
}

const commenter = {
  isHost: false,
  role: EventMemberRole.COMMENTER,
  surfaces: [EventSurface.CHECKLIST, EventSurface.BUDGET],
}

const viewer = {
  isHost: false,
  role: EventMemberRole.VIEWER,
  surfaces: [EventSurface.CHECKLIST],
}

const editor = {
  isHost: false,
  role: EventMemberRole.EDITOR,
  surfaces: [EventSurface.CHECKLIST],
}

const host = {
  isHost: true,
  role: 'HOST' as const,
  surfaces: [EventSurface.CHECKLIST],
}

describe('event access roles', () => {
  it('only hosts and editors may mutate items', () => {
    expect(roleAllowsEdit(host)).toBe(true)
    expect(roleAllowsEdit(editor)).toBe(true)
    expect(roleAllowsEdit(commenter)).toBe(false)
    expect(roleAllowsEdit(viewer)).toBe(false)
  })

  it('commenters may comment but not edit', () => {
    expect(roleAllowsComment(commenter)).toBe(true)
    expect(memberCanSee(commenter, EventSurface.CHECKLIST)).toBe(true)
    expect(memberCanComment(commenter, EventSurface.CHECKLIST)).toBe(true)
    expect(memberCanEdit(commenter, EventSurface.CHECKLIST)).toBe(false)
  })

  it('viewers may see but not comment or edit', () => {
    expect(roleAllowsComment(viewer)).toBe(false)
    expect(memberCanSee(viewer, EventSurface.CHECKLIST)).toBe(true)
    expect(memberCanComment(viewer, EventSurface.CHECKLIST)).toBe(false)
    expect(memberCanEdit(viewer, EventSurface.CHECKLIST)).toBe(false)
  })

  it('denies edit even when no surface is passed', () => {
    expect(allowsAction(commenter, 'edit')).toBe(false)
    expect(allowsAction(viewer, 'edit')).toBe(false)
    expect(allowsAction(editor, 'edit')).toBe(true)
    expect(allowsAction(host, 'edit')).toBe(true)
  })

  it('denies edit on a surface the editor cannot see', () => {
    expect(allowsAction(editor, 'edit', EventSurface.BUDGET)).toBe(false)
    expect(allowsAction(editor, 'edit', EventSurface.CHECKLIST)).toBe(true)
  })

  it('denies comment for viewers even with no surface', () => {
    expect(allowsAction(viewer, 'comment')).toBe(false)
    expect(allowsAction(commenter, 'comment')).toBe(true)
  })

  it('denies Checklist edit when the member only has Schedule', () => {
    const scheduleOnly = {
      isHost: false,
      role: EventMemberRole.EDITOR,
      surfaces: [EventSurface.SCHEDULE],
    }
    expect(allowsAction(scheduleOnly, 'edit', EventSurface.CHECKLIST)).toBe(false)
    expect(allowsAction(scheduleOnly, 'view', EventSurface.CHECKLIST)).toBe(false)
  })
})

describe('canSeeChecklistRow', () => {
  const svc = accessService({})
  const member = { isHost: false, memberId: 'm1' } as EventAccess
  const hostAccess = { isHost: true, memberId: undefined } as EventAccess

  it('lets the host see a concealed row', () => {
    expect(svc.canSeeChecklistRow(hostAccess, [{ eventMemberId: 'm1' }])).toBe(true)
  })

  it('hides the row from the concealed member', () => {
    expect(svc.canSeeChecklistRow(member, [{ eventMemberId: 'm1' }])).toBe(false)
  })

  it('shows the row to a different member', () => {
    expect(svc.canSeeChecklistRow(member, [{ eventMemberId: 'm2' }])).toBe(true)
    expect(svc.canSeeChecklistRow(member, [])).toBe(true)
  })
})

describe('loadMany', () => {
  it('returns host access for owned events in one user lookup', async () => {
    const user = { id: 'u1', clerkId: 'clerk_1', email: 'a@x.com' }
    const hosted = { id: 'evt1', userId: 'u1', parentId: null, deletedAt: null }
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
      event: { findMany: jest.fn().mockResolvedValue([hosted]) },
      eventMember: { findMany: jest.fn(), update: jest.fn() },
      eventSubGrant: { findMany: jest.fn() },
    }
    const svc = accessService(prisma)
    const map = await svc.loadMany('clerk_1', ['evt1', 'evt1'])
    expect(map.get('evt1')?.isHost).toBe(true)
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.eventMember.findMany).not.toHaveBeenCalled()
  })

  it('marks missing events as null without throwing', async () => {
    const user = { id: 'u1', clerkId: 'clerk_1', email: 'a@x.com' }
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
    }
    const svc = accessService(prisma)
    const map = await svc.loadMany('clerk_1', ['gone'])
    expect(map.get('gone')).toBeNull()
  })
})

describe('accepted membership binding', () => {
  const user = { id: 'u1', clerkId: 'clerk_1', email: 'now@x.com' }
  const event = { id: 'evt1', userId: 'host', parentId: null, deletedAt: null }

  it('does not grant access via another member row that only shares the current email', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
      event: { findFirst: jest.fn().mockResolvedValue(event) },
      eventMember: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    }
    const svc = accessService(prisma)
    await expect(svc.load('clerk_1', 'evt1')).rejects.toMatchObject({ message: 'Event not found' })
    expect(prisma.eventMember.update).not.toHaveBeenCalled()
    expect(prisma.eventMember.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ userId: null }),
      }),
    )
  })

  it('links an accepted orphan row that still has no userId', async () => {
    const orphan = {
      id: 'm-orphan',
      role: EventMemberRole.VIEWER,
      surfaces: [EventSurface.CHECKLIST],
    }
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(user) },
      event: { findFirst: jest.fn().mockResolvedValue(event) },
      eventMember: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(orphan),
        update: jest.fn().mockResolvedValue({ ...orphan, userId: user.id }),
      },
    }
    const svc = accessService(prisma)
    const access = await svc.load('clerk_1', 'evt1')
    expect(access.memberId).toBe('m-orphan')
    expect(prisma.eventMember.update).toHaveBeenCalledWith({
      where: { id: 'm-orphan' },
      data: { userId: 'u1' },
    })
  })

  it('denies a soft-deleted user (FR-24)', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      event: { findFirst: jest.fn() },
    }
    const svc = accessService(prisma)
    await expect(svc.load('clerk_deleted', 'evt1')).rejects.toMatchObject({
      message: 'Event not found',
    })
    expect(prisma.event.findFirst).not.toHaveBeenCalled()
  })
})
