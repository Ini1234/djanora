import { NotFoundException, UnauthorizedException } from '@nestjs/common'
import { McpConfirmService } from './mcp.confirm.service'
import { mcpCtx } from './mcp.context'
import { nestToMcp } from './mcp.errors'
import { decodeUpload } from './mcp.files'
import { payloadHash } from './mcp.hash'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpJobsService } from './mcp.jobs'
import { McpRateLimitService } from './mcp.rate-limit'
import { McpRegistry } from './mcp.registry'
import { McpScopeService } from './mcp.scope'
import { McpSessionService } from './mcp.session.service'

describe('mcp.errors', () => {
  it('maps missing auth to unauthorized', () => {
    expect(
      nestToMcp(new UnauthorizedException('Missing or invalid authorization header')).code,
    ).toBe('unauthorized')
  })

  it('maps concealment and missing events to not_found', () => {
    expect(nestToMcp(new NotFoundException('Event not found')).code).toBe('not_found')
  })
})

describe('mcp.hash', () => {
  it('ignores confirm_token when hashing payloads', () => {
    expect(payloadHash('publish_site', { event_id: 'e1', confirm_token: 'a' })).toBe(
      payloadHash('publish_site', { event_id: 'e1' }),
    )
  })
})

describe('mcp.files', () => {
  it('rejects gif for site/party images and oversized files', () => {
    expect(() => decodeUpload({ mime: 'image/gif', base64: 'aaaa', kind: 'image' })).toThrow()
    const huge = Buffer.alloc(9 * 1024 * 1024, 1).toString('base64')
    expect(() => decodeUpload({ mime: 'image/jpeg', base64: huge, kind: 'image' })).toThrow()
  })
})

describe('mcp.context', () => {
  it('refuses tools without a Clerk user', () => {
    expect(() =>
      mcpCtx({
        authInfo: undefined,
        sessionId: 's1',
        signal: new AbortController().signal,
        requestId: '1',
        sendNotification: () => undefined,
        sendRequest: () => ({}),
      } as never),
    ).toThrow(/Sign in/)
  })

  it('sticks current-event to the Clerk user when MCP has no session id', () => {
    expect(
      mcpCtx({
        authInfo: { extra: { userId: 'user_abc' } },
        sessionId: undefined,
        signal: new AbortController().signal,
        requestId: '1',
        sendNotification: () => undefined,
        sendRequest: () => ({}),
      } as never).sessionId,
    ).toBe('user:user_abc')
  })
})

describe('mcp.session', () => {
  it('starts a new session with no current event', async () => {
    const prisma = {
      mcpSession: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'sess-new',
          currentEventId: null,
          lastUsedAt: new Date(),
        }),
      },
    }
    const users = { ensureFromClerk: jest.fn().mockResolvedValue({ id: 'u1' }) }
    const svc = new McpSessionService(prisma as never, users as never)
    const row = await svc.touch('sess-new', 'clerk_1')
    expect(row.currentEventId).toBeNull()
    expect(prisma.mcpSession.create).toHaveBeenCalled()
  })
})

describe('mcp.scope', () => {
  const events = {
    findByUser: jest.fn(),
  }
  const access = { require: jest.fn() }
  const sessions = {
    currentEventId: jest.fn(),
    setCurrentEvent: jest.fn(),
  }
  const scope = new McpScopeService(events as never, access as never, sessions as never)

  beforeEach(() => {
    jest.clearAllMocks()
    events.findByUser.mockResolvedValue([
      { id: 'a', title: 'Reception', estimatedDate: null },
      { id: 'b', title: 'Reception', estimatedDate: null },
    ])
  })

  it('refuses an ambiguous title', async () => {
    await expect(scope.resolve('s', 'clerk', { event_title: 'Reception' })).rejects.toMatchObject({
      body: { code: 'needs_event' },
    })
  })

  it('refuses when no event is set on a new session', async () => {
    sessions.currentEventId.mockResolvedValue(null)
    events.findByUser.mockResolvedValue([{ id: 'a', title: 'One', estimatedDate: null }])
    await expect(scope.resolve('s', 'clerk', {})).rejects.toMatchObject({
      body: { code: 'needs_event' },
    })
  })
})

describe('mcp.confirm', () => {
  function setup() {
    const store: Record<string, unknown>[] = []
    const prisma = {
      mcpConfirmToken: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          store.push({ ...data, id: 'tok1', spentAt: null })
          return Promise.resolve(data)
        }),
        findUnique: jest.fn(({ where }: { where: { tokenHash: string } }) =>
          Promise.resolve(store.find((r) => r.tokenHash === where.tokenHash) ?? null),
        ),
        update: jest.fn(({ where, data }: { where: { id: string }; data: { spentAt: Date } }) => {
          const row = store.find((r) => r.id === where.id)
          if (row) Object.assign(row, data)
          return Promise.resolve(row)
        }),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    }
    const users = { ensureFromClerk: jest.fn().mockResolvedValue({ id: 'u1' }) }
    const sessions = {
      touch: jest.fn().mockResolvedValue({ id: 'sess-a', userId: 'u1' }),
    }
    const svc = new McpConfirmService(prisma as never, users as never, sessions as never)
    return { svc, prisma, sessions, store }
  }

  it('preview does not mutate and spend is single-use', async () => {
    const { svc } = setup()
    const preview = await svc.preview(
      'sess-a',
      'clerk',
      'publish_site',
      { event_id: 'e1' },
      'Publish',
      'Public',
    )
    expect(preview.code).toBe('needs_confirm')
    expect(preview.confirm_token).toBeTruthy()
    await svc.spend('sess-a', 'clerk', 'publish_site', {
      event_id: 'e1',
      confirm_token: preview.confirm_token,
    })
    await expect(
      svc.spend('sess-a', 'clerk', 'publish_site', {
        event_id: 'e1',
        confirm_token: preview.confirm_token,
      }),
    ).rejects.toMatchObject({ body: { code: 'already_done' } })
  })

  it('rejects an expired token as expired', async () => {
    const { svc, store } = setup()
    const preview = await svc.preview(
      'sess-a',
      'clerk',
      'publish_site',
      { event_id: 'e1' },
      'Publish',
      'Public',
    )
    store[0].expiresAt = new Date(0)
    await expect(
      svc.spend('sess-a', 'clerk', 'publish_site', {
        event_id: 'e1',
        confirm_token: preview.confirm_token,
      }),
    ).rejects.toMatchObject({ body: { code: 'expired' } })
  })

  it('rejects a token from another session or tool', async () => {
    const { svc, sessions } = setup()
    const preview = await svc.preview(
      'sess-a',
      'clerk',
      'publish_site',
      { event_id: 'e1' },
      'P',
      'B',
    )
    sessions.touch.mockResolvedValue({ id: 'sess-b', userId: 'u1' })
    await expect(
      svc.spend('sess-b', 'clerk', 'publish_site', {
        event_id: 'e1',
        confirm_token: preview.confirm_token,
      }),
    ).rejects.toMatchObject({ body: { code: 'invalid' } })
    sessions.touch.mockResolvedValue({ id: 'sess-a', userId: 'u1' })
    await expect(
      svc.spend('sess-a', 'clerk', 'delete_event', {
        event_id: 'e1',
        confirm_token: preview.confirm_token,
      }),
    ).rejects.toMatchObject({ body: { code: 'invalid' } })
  })
})

describe('mcp.jobs confirm gates', () => {
  function jobs(overrides: Record<string, unknown> = {}) {
    const confirm = {
      preview: jest.fn().mockResolvedValue({
        code: 'needs_confirm',
        summary: 'preview',
        blast_radius: 'blast',
        confirm_token: 'tok',
        expires_at: new Date().toISOString(),
      }),
      spend: jest.fn().mockResolvedValue(undefined),
    }
    const sites = { publish: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }) }
    const inquiries = { bookQuote: jest.fn().mockResolvedValue({ booked: true }) }
    const guests = {
      listGuests: jest.fn().mockRejectedValue(new NotFoundException('Event not found')),
    }
    const events = {
      listChecklist: jest.fn().mockRejectedValue(new NotFoundException('Event not found')),
    }
    const scope = { resolve: jest.fn().mockResolvedValue('e1'), listRefs: jest.fn() }
    const sessions = { touch: jest.fn(), setCurrentEvent: jest.fn(), currentEventId: jest.fn() }
    const rate = new McpRateLimitService()
    const svc = new McpJobsService(
      {} as never,
      events as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      guests as never,
      sites as never,
      inquiries as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      scope as never,
      sessions as never,
      confirm as never,
      rate,
    )
    Object.assign(svc, overrides)
    return { svc, confirm, sites, inquiries, guests, events }
  }

  const ctx = { clerkId: 'clerk', sessionId: 'sess-a' }

  it('publish_site without a token does not publish', async () => {
    const { svc, sites, confirm } = jobs()
    const out = await svc.run(ctx, 'publish_site', { event_id: 'e1' })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(sites.publish).not.toHaveBeenCalled()
    expect(confirm.preview).toHaveBeenCalled()
  })

  it('book_vendor without a token does not book', async () => {
    const { svc, inquiries } = jobs()
    const out = await svc.run(ctx, 'book_vendor', { inquiry_id: 'i1', message_id: 'm1' })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(inquiries.bookQuote).not.toHaveBeenCalled()
  })

  it('import_schedule without a token does not write', async () => {
    const events = { importScheduleItems: jest.fn() }
    const { svc, confirm } = jobs({ events })
    const out = await svc.run(ctx, 'import_schedule', {
      event_id: 'e1',
      items: [{ title: 'Introduction', date: '2027-10-08', start_time: '10:00' }],
    })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(events.importScheduleItems).not.toHaveBeenCalled()
    expect(confirm.preview).toHaveBeenCalledWith(
      'sess-a',
      'clerk',
      'import_schedule',
      expect.objectContaining({ event_id: 'e1' }),
      'Add 1 schedule block?',
      expect.stringContaining('Review every row'),
    )
  })

  it('apply_weekend without a token does not write children', async () => {
    const events = {
      findById: jest.fn().mockResolvedValue({
        id: 'e1',
        title: 'Ima & Oct',
        tribes: ['YORUBA'],
      }),
      applyWeekend: jest.fn(),
    }
    const { svc } = jobs({ events })
    const out = await svc.run(ctx, 'apply_weekend', {
      event_id: 'e1',
      ceremonies: [{ event_type: 'introduction', date: '2027-10-08' }],
    })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(events.applyWeekend).not.toHaveBeenCalled()
  })

  it('draft_site_copy without a token does not patch the site', async () => {
    const sites = { draftCopy: jest.fn(), publish: jest.fn() }
    const { svc } = jobs({ sites })
    const out = await svc.run(ctx, 'draft_site_copy', {
      event_id: 'e1',
      about: 'We met in Lagos.',
    })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(sites.draftCopy).not.toHaveBeenCalled()
  })

  it('bulk_invite_guests confirm card lists names', async () => {
    const guests = {
      listGuests: jest.fn().mockResolvedValue([
        { id: 'g1', firstName: 'Ada', lastName: 'Okonkwo', invite: { sentAt: null } },
        { id: 'g2', firstName: 'Tunde', lastName: 'Ade', invite: { sentAt: new Date() } },
      ]),
      bulkSendInvites: jest.fn(),
    }
    const { svc, confirm } = jobs({ guests })
    const out = await svc.run(ctx, 'bulk_invite_guests', {
      event_id: 'e1',
      guest_ids: ['g1', 'g2'],
    })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(guests.bulkSendInvites).not.toHaveBeenCalled()
    expect(confirm.preview).toHaveBeenCalledWith(
      'sess-a',
      'clerk',
      'bulk_invite_guests',
      expect.objectContaining({ guest_ids: ['g1', 'g2'] }),
      'Send RSVP invites to 2 guests',
      expect.stringMatching(/Ada Okonkwo[\s\S]*Tunde Ade — already invited/),
    )
  })

  it('import_guests without a token does not write', async () => {
    const guests = { importGuests: jest.fn() }
    const { svc, confirm } = jobs({ guests })
    const out = await svc.run(ctx, 'import_guests', {
      event_id: 'e1',
      guests: [{ first_name: 'Ada' }],
    })
    expect(out).toMatchObject({ code: 'needs_confirm' })
    expect(guests.importGuests).not.toHaveBeenCalled()
    expect(confirm.preview).toHaveBeenCalledWith(
      'sess-a',
      'clerk',
      'import_guests',
      { event_id: 'e1', guests: [{ first_name: 'Ada' }] },
      'Add 1 guest?',
      expect.stringContaining('Review every row'),
    )
  })

  it('list_guests without GUESTS maps to not_found', async () => {
    const { svc, guests } = jobs()
    await expect(svc.run(ctx, 'list_guests', { event_id: 'e1' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(guests.listGuests).toHaveBeenCalledWith('clerk', 'e1')
  })
})

describe('mcp.rate-limit', () => {
  it('trips after 61 cheap calls', () => {
    const rate = new McpRateLimitService()
    for (let i = 0; i < 60; i++) rate.hit('u', false)
    expect(() => rate.hit('u', false)).toThrow()
  })
})

describe('mcp.registry', () => {
  it('uses a new McpServer per connection so a second request does not throw', async () => {
    const registry = new McpRegistry({ run: jest.fn() } as never)
    const first = registry.createServer()
    const second = registry.createServer()
    const t1 = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    const t2 = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await first.connect(t1)
    await expect(first.connect(t2)).rejects.toThrow(/Already connected/)
    await expect(second.connect(t2)).resolves.toBeUndefined()
    await t1.close()
    await t2.close()
    await first.close()
    await second.close()
  })
})
