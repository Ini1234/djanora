import { emptyTranscript, parseTranscript, withTranscriptIdentity } from './assistant.transcript'

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
