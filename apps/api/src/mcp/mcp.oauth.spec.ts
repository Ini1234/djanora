import {
  DcrError,
  isSafeRedirectUri,
  McpOAuthService,
  publicClient,
  toRfc7591Client,
  withNestRegistration,
} from './mcp.oauth'

describe('mcp.oauth helpers', () => {
  it('accepts https and localhost redirects only', () => {
    expect(isSafeRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
    expect(isSafeRedirectUri('http://localhost:8080/callback')).toBe(true)
    expect(isSafeRedirectUri('http://127.0.0.1:8080/callback')).toBe(true)
    expect(isSafeRedirectUri('http://evil.example/callback')).toBe(false)
    expect(isSafeRedirectUri('javascript:alert(1)')).toBe(false)
  })

  it('treats omitted auth method as a public client', () => {
    expect(publicClient(undefined)).toBe(true)
    expect(publicClient('none')).toBe(true)
    expect(publicClient('client_secret_basic')).toBe(false)
  })

  it('maps a Clerk OAuth app to RFC 7591', () => {
    const payload = toRfc7591Client(
      {
        clientId: 'client_abc',
        clientSecret: undefined,
        createdAt: 1_700_000_000_000,
        name: 'Claude',
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
        scopes: 'profile email',
      } as never,
      'none',
    )
    expect(payload.client_id).toBe('client_abc')
    expect(payload.token_endpoint_auth_method).toBe('none')
    expect('client_secret' in payload).toBe(false)
  })

  it('injects Nest registration_endpoint', () => {
    expect(
      withNestRegistration({ issuer: 'https://clerk.example' }, 'https://api.example')
        .registration_endpoint,
    ).toBe('https://api.example/oauth/register')
  })
})

describe('McpOAuthService.register', () => {
  const originalFetch = global.fetch
  const config = { get: (key: string) => (key === 'CLERK_SECRET_KEY' ? 'sk_test' : undefined) }

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('rejects missing redirect_uris', async () => {
    const svc = new McpOAuthService(config as never)
    await expect(svc.register({}, 'ip')).rejects.toBeInstanceOf(DcrError)
    await expect(svc.register({}, 'ip')).rejects.toMatchObject({ error: 'invalid_redirect_uri' })
  })

  it('rejects non-https remote redirects', async () => {
    const svc = new McpOAuthService(config as never)
    await expect(
      svc.register({ redirect_uris: ['http://evil.example/cb'] }, 'ip'),
    ).rejects.toMatchObject({ error: 'invalid_redirect_uri' })
  })

  it('uses Clerk when CIMD is advertised', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ client_id_metadata_documents_advertised: true }),
    })
    const svc = new McpOAuthService(config as never)
    await expect(svc.discoverOAuthMode()).resolves.toBe('clerk')
  })

  it('uses Clerk when DCR is advertised', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ dynamic_oauth_client_registration: true }),
    })
    const svc = new McpOAuthService(config as never)
    await expect(svc.discoverOAuthMode()).resolves.toBe('clerk')
  })

  it('falls back to Nest DCR when Clerk advertises neither CIMD nor DCR', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          client_id_metadata_documents_advertised: false,
          dynamic_oauth_client_registration: false,
        }),
    })
    const svc = new McpOAuthService(config as never)
    await expect(svc.discoverOAuthMode()).resolves.toBe('nest')
  })
})
