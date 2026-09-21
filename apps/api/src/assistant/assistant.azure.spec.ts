import { chatRequestBodies, usesCompletionTokens } from './assistant.azure'

describe('assistant.azure helpers', () => {
  it('treats gpt-5 and o-series as completion-token models', () => {
    expect(usesCompletionTokens('gpt-5-mini')).toBe(true)
    expect(usesCompletionTokens('gpt-5.4-mini')).toBe(true)
    expect(usesCompletionTokens('gpt-4.1-mini')).toBe(false)
  })

  it('does not send temperature for gpt-5 deployments', () => {
    const [body] = chatRequestBodies('gpt-5-nano', [], [], 200)
    expect(body).toEqual(expect.objectContaining({ max_completion_tokens: 200 }))
    expect(body).not.toHaveProperty('temperature')
    expect(body).not.toHaveProperty('max_tokens')
  })

  it('sends max_tokens first for gpt-4.1-mini', () => {
    const [body] = chatRequestBodies('gpt-4.1-mini', [], [], 200)
    expect(body).toEqual(expect.objectContaining({ max_tokens: 200, temperature: 0.3 }))
  })
})
