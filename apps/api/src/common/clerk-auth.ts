import type { ConfigService } from '@nestjs/config'

/** Clerk JWT `azp` allowlist. Empty when neither env is set so local tokens still verify. */
export function clerkAuthorizedParties(config: ConfigService): string[] | undefined {
  const raw = config.get<string>('CLERK_AUTHORIZED_PARTIES')
  if (raw?.trim()) {
    const parties = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    return parties.length ? parties : undefined
  }
  const web = config.get<string>('WEB_URL')?.trim()
  return web ? [web] : undefined
}

export function clerkVerifyOptions(config: ConfigService) {
  const authorizedParties = clerkAuthorizedParties(config)
  return {
    secretKey: config.get<string>('CLERK_SECRET_KEY')!,
    ...(authorizedParties ? { authorizedParties } : {}),
  }
}

export function corsOrigins(): string[] {
  const web = process.env.WEB_URL?.trim() || 'http://localhost:3000'
  const extras = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set([web, 'http://localhost:3000', 'http://127.0.0.1:3000', ...extras])]
}

/** MCP resource, OAuth discovery, and optional Nest DCR — probed by Claude from the browser. */
export function isMcpPublicPath(path: string) {
  const raw = path.split('?')[0] ?? ''
  let end = raw.length
  while (end > 0 && raw[end - 1] === '/') end -= 1
  const p = raw.slice(0, end) || '/'
  return (
    p === '/mcp' ||
    p.startsWith('/mcp/') ||
    p.startsWith('/.well-known/oauth-protected-resource') ||
    p.startsWith('/.well-known/oauth-authorization-server') ||
    p === '/oauth/register'
  )
}

export function corsOptionsForPath(path: string) {
  if (isMcpPublicPath(path)) {
    return {
      origin: true as const,
      credentials: true,
      exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
    }
  }
  return {
    origin: corsOrigins(),
    credentials: true,
    exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  }
}
