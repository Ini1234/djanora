import {
  confirmTokensIn,
  emptyTranscript,
  parseTranscript,
  withoutConfirmTokens,
  withTranscriptIdentity,
} from './assistant.transcript'

describe('parseTranscript', () => {
  it('returns empty for invalid JSON', () => {
    const parsed = parseTranscript('nope')
    expect(parsed.messages).toEqual([])
    expect(parsed.userId).toBe('')
    expect(parsed.sessionId).toBe('')
  })

  it('keeps userId, sessionId, and well-formed messages', () => {
    const parsed = parseTranscript(
      JSON.stringify({
        version: 1,
        userId: 'user_abc',
        sessionId: 'assistant:t1',
        messages: [
          { id: 'm1', role: 'user', content: 'hi', createdAt: '2026-09-21T00:00:00.000Z' },
          { role: 'system', content: 'ignore' },
          { id: 'm2', role: 'assistant', content: 'hello', parts: { jobs: ['list_events'] } },
        ],
      }),
    )
    expect(parsed.userId).toBe('user_abc')
    expect(parsed.sessionId).toBe('assistant:t1')
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0]).toMatchObject({ id: 'm1', role: 'user', content: 'hi' })
    expect(parsed.messages[1]).toMatchObject({ role: 'assistant', content: 'hello' })
  })

  it('starts empty for a user and session', () => {
    expect(emptyTranscript('user_abc', 'assistant:t1')).toEqual({
      version: 1,
      userId: 'user_abc',
      sessionId: 'assistant:t1',
      messages: [],
    })
  })

  it('stamps missing identity and rejects a different owner or session', () => {
    const identity = { userId: 'user_abc', sessionId: 'assistant:t1' }
    const stamped = withTranscriptIdentity(
      { version: 1, userId: '', sessionId: '', messages: [] },
      identity,
    )
    expect(stamped).toMatchObject(identity)
    expect(
      withTranscriptIdentity(
        { version: 1, userId: 'other', sessionId: 'assistant:t1', messages: [] },
        identity,
      ),
    ).toBeNull()
    expect(
      withTranscriptIdentity(
        { version: 1, userId: 'user_abc', sessionId: 'assistant:other', messages: [] },
        identity,
      ),
    ).toBeNull()
  })
})

describe('confirm cards on a transcript', () => {
  const message = {
    id: 'm1',
    role: 'assistant' as const,
    content: 'Add these guests?',
    createdAt: '2026-09-21T00:00:00.000Z',
    parts: {
      confirms: [
        { tool: 'import_guests', confirm_token: 'tok-a', summary: 'Add 5' },
        { tool: 'import_guests', confirm_token: 'tok-b', summary: 'Add 2' },
      ],
    },
  }

  it('lists confirm tokens', () => {
    expect(confirmTokensIn([message])).toEqual(['tok-a', 'tok-b'])
  })

  it('drops spent cards and leaves the rest', () => {
    const next = withoutConfirmTokens([message], new Set(['tok-a']))
    expect(confirmTokensIn(next)).toEqual(['tok-b'])
    expect(withoutConfirmTokens([message], new Set(['tok-a', 'tok-b']))[0].parts).toBeNull()
  })
})
