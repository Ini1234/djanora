import { AssistantAgentService } from './assistant.agent'

describe('assistant.agent', () => {
  const azure = { chat: jest.fn() }
  const jobs = { run: jest.fn() }
  const sessions = { touch: jest.fn() }
  const navigate = { propose: jest.fn() }
  const agent = new AssistantAgentService(
    azure as never,
    jobs as never,
    sessions as never,
    navigate as never,
  )

  beforeEach(() => {
    jest.resetAllMocks()
    sessions.touch.mockResolvedValue({})
  })

  it('looks up founder culture notes without calling MCP jobs', async () => {
    const result = await agent.executeTool('user_1', 'assistant:t1', 'lookup_culture', {
      tribe: 'Yoruba',
      ceremony: 'introduction',
    })
    expect(jobs.run).not.toHaveBeenCalled()
    expect(result).toEqual(expect.objectContaining({ found: true, tribe: 'YORUBA' }))
  })

  it('refuses unknown cities', async () => {
    await expect(
      agent.executeTool('user_1', 'assistant:t1', 'lookup_city', { city: 'Narnia' }),
    ).resolves.toEqual(expect.objectContaining({ found: false }))
  })

  it('strips model-invented confirm tokens and surfaces a confirm card', async () => {
    azure.chat.mockResolvedValueOnce({
      model: 'test',
      usage: { prompt_tokens: 10, completion_tokens: 5 },
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: {
              name: 'publish_site',
              arguments: JSON.stringify({ event_id: 'e1', confirm_token: 'forged' }),
            },
          },
        ],
      },
    })
    jobs.run.mockResolvedValue({
      code: 'needs_confirm',
      summary: 'Publish the site',
      blast_radius: 'Public URL goes live',
      confirm_token: 'real-token',
      expires_at: '2099-01-01T00:00:00.000Z',
    })

    const turn = await agent.run({
      clerkId: 'user_1',
      threadId: 't1',
      activeMode: 'user',
      userMessage: 'publish the site',
      history: [],
    })

    expect(jobs.run).toHaveBeenCalledWith(
      { clerkId: 'user_1', sessionId: 'assistant:t1' },
      'publish_site',
      { event_id: 'e1' },
    )
    expect(turn.confirms[0]?.confirm_token).toBe('real-token')
    expect(turn.content).toMatch(/confirm/i)
  })

  it('opens screens through propose_navigation without MCP jobs', async () => {
    azure.chat
      .mockResolvedValueOnce({
        model: 'test',
        usage: { prompt_tokens: 4, completion_tokens: 2 },
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'n1',
              type: 'function',
              function: {
                name: 'propose_navigation',
                arguments: JSON.stringify({ screen: 'event', tab: 'budget' }),
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        model: 'test',
        usage: { prompt_tokens: 4, completion_tokens: 6 },
        message: { role: 'assistant', content: 'Opening the budget.' },
      })
    navigate.propose.mockResolvedValue({ href: '/events/e1?tab=budget', label: 'Event (budget)' })

    const turn = await agent.run({
      clerkId: 'user_1',
      threadId: 't1',
      activeMode: 'user',
      userMessage: 'take me to the budget',
      history: [],
    })

    expect(jobs.run).not.toHaveBeenCalled()
    expect(navigate.propose).toHaveBeenCalledWith({
      clerkId: 'user_1',
      sessionId: 'assistant:t1',
      activeMode: 'user',
      args: { screen: 'event', tab: 'budget' },
    })
    expect(turn.navigations).toEqual([{ href: '/events/e1?tab=budget', label: 'Event (budget)' }])
  })
})
