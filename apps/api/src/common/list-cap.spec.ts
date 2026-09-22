import {
  ASSIGNED_CHECKLIST_CAP,
  GUEST_LIST_CAP,
  INQUIRY_LIST_CAP,
  INQUIRY_MESSAGE_CAP,
  REMINDER_BATCH_CAP,
  VECTOR_CANDIDATE_CAP,
} from './list-cap'

describe('list caps', () => {
  it('keeps guest and inquiry lists bounded', () => {
    expect(GUEST_LIST_CAP).toBe(500)
    expect(INQUIRY_LIST_CAP).toBe(100)
    expect(INQUIRY_MESSAGE_CAP).toBe(200)
  })

  it('keeps background jobs and vector scans bounded', () => {
    expect(REMINDER_BATCH_CAP).toBe(200)
    expect(ASSIGNED_CHECKLIST_CAP).toBe(200)
    expect(VECTOR_CANDIDATE_CAP).toBe(200)
  })
})
