import { EventCommentSubject } from '@prisma/client'
import { commentHref } from './event-comments.service'

describe('commentHref', () => {
  it('deep-links schedule comments to the item and comment', () => {
    expect(commentHref('evt1', EventCommentSubject.SCHEDULE_ITEM, 'item1', 'c1'))
      .toBe('/events/evt1?tab=schedule&item=item1&comment=c1')
  })

  it('deep-links event-level comments to overview', () => {
    expect(commentHref('evt1', EventCommentSubject.EVENT, 'evt1', 'c9'))
      .toBe('/events/evt1?tab=overview&comment=c9')
  })

  it('omits the comment query when no comment id is given', () => {
    expect(commentHref('evt1', EventCommentSubject.EVENT, 'evt1'))
      .toBe('/events/evt1?tab=overview')
  })

  it('deep-links mood-board comments', () => {
    expect(commentHref('evt1', EventCommentSubject.MOOD_BOARD_ITEM, 'mb1', 'c2'))
      .toBe('/events/evt1?tab=moodboard&item=mb1&comment=c2')
  })
})
