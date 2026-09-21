import { clerkAuthorizedParties, clerkVerifyOptions, corsOrigins } from './clerk-auth'

describe('clerkAuthorizedParties', () => {
  it('splits CLERK_AUTHORIZED_PARTIES', () => {
    expect(
      clerkAuthorizedParties({
        get: (key: string) =>
          key === 'CLERK_AUTHORIZED_PARTIES' ? 'https://a.test, https://b.test' : undefined,
      } as never),
    ).toEqual(['https://a.test', 'https://b.test'])
  })

  it('falls back to WEB_URL', () => {
    expect(
      clerkAuthorizedParties({
        get: (key: string) => (key === 'WEB_URL' ? 'http://localhost:3000' : undefined),
      } as never),
    ).toEqual(['http://localhost:3000'])
  })

  it('omits authorizedParties when neither env is set', () => {
    expect(clerkVerifyOptions({ get: () => undefined } as never)).toEqual({
      secretKey: undefined,
    })
  })
})

describe('corsOrigins', () => {
  const prevWeb = process.env.WEB_URL
  const prevCors = process.env.CORS_ORIGINS

  afterEach(() => {
    if (prevWeb === undefined) delete process.env.WEB_URL
    else process.env.WEB_URL = prevWeb
    if (prevCors === undefined) delete process.env.CORS_ORIGINS
    else process.env.CORS_ORIGINS = prevCors
  })

  it('always includes localhost and WEB_URL', () => {
    process.env.WEB_URL = 'https://djanora.test'
    delete process.env.CORS_ORIGINS
    expect(corsOrigins()).toEqual([
      'https://djanora.test',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ])
  })
})
