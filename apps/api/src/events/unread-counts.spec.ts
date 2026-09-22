import { applyUnreadRows, emptyUnreadCounts } from './unread-counts'

describe('unread count merge', () => {
  it('starts every surface at zero', () => {
    expect(emptyUnreadCounts(['OVERVIEW', 'CHECKLIST'])).toEqual({
      OVERVIEW: 0,
      CHECKLIST: 0,
    })
  })

  it('applies SQL group rows without inventing surfaces', () => {
    const base = emptyUnreadCounts(['OVERVIEW', 'CHECKLIST'])
    expect(
      applyUnreadRows(base, [
        { key: 'CHECKLIST', count: 4 },
        { key: 'UNKNOWN', count: 9 },
      ]),
    ).toEqual({ OVERVIEW: 0, CHECKLIST: 4 })
  })
})
