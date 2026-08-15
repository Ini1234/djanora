import { EventMemberRole, EventSurface } from '@prisma/client'
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
  const svc = new EventAccessService({} as never)
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
