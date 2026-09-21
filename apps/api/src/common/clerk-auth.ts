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
