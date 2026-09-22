import { importConfirmMessage, isAlreadyDone, isJobFailure, jobFailureCopy } from './assistant.copy'

describe('jobFailureCopy', () => {
  it('never mentions the tool or confirm token', () => {
    expect(jobFailureCopy('already_done')).toBe("That's already done.")
    expect(jobFailureCopy('expired')).toBe('That confirm expired. Ask me to preview again.')
    expect(jobFailureCopy('invalid')).toBe(
      'That confirm is no longer valid. Ask me to preview again.',
    )
    expect(jobFailureCopy('unavailable')).toBe("I couldn't finish that.")
    expect(jobFailureCopy('nope')).toBe("I couldn't finish that.")
    expect(jobFailureCopy('already_done')).not.toMatch(/import_|confirm_token|token/i)
  })
})

describe('job result flags', () => {
  it('treats already_done as a quiet non-failure for the transcript', () => {
    expect(isAlreadyDone({ code: 'already_done', message: 'Confirm token was already used' })).toBe(
      true,
    )
    expect(isJobFailure({ code: 'already_done' })).toBe(true)
    expect(isJobFailure({ created: 12 })).toBe(false)
    expect(isJobFailure({ code: 'ok' })).toBe(false)
  })
})

describe('importConfirmMessage', () => {
  it('reports created rows without the tool slug', () => {
    expect(importConfirmMessage('import_guests', { created: 12, skipped: 1 })).toBe(
      'Added 12, skipped 1 already on the event',
    )
    expect(importConfirmMessage('publish_site', { status: 'PUBLISHED' })).toBe('Done.')
  })
})
