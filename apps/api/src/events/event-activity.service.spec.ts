import { EventSurface } from '@prisma/client'
import { OVERVIEW_SURFACE, unreadSurfaceKey } from './event-activity.service'

describe('unreadSurfaceKey', () => {
  it('maps a missing surface to Overview', () => {
    expect(unreadSurfaceKey(null)).toBe(OVERVIEW_SURFACE)
    expect(OVERVIEW_SURFACE).toBe('OVERVIEW')
  })

  it('keeps named event surfaces as-is', () => {
    expect(unreadSurfaceKey(EventSurface.CHECKLIST)).toBe('CHECKLIST')
    expect(unreadSurfaceKey(EventSurface.BUDGET)).toBe('BUDGET')
  })
})
