import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClerkClient } from '@clerk/backend'
import type { OAuthApplication } from '@clerk/backend'
import { publicApiBase } from '../uploads/public-upload-url'

const CLERK_OAUTH_SETTINGS = 'https://api.clerk.com/v1/instance/oauth_application_settings'
const MCP_SCOPES = 'profile email'
const REGISTER_WINDOW_MS = 60_000
const REGISTER_LIMIT = 20

export type OAuthMode = 'clerk' | 'nest'

type ClerkOAuthSettings = {
  client_id_metadata_documents_advertised?: boolean
  dynamic_oauth_client_registration?: boolean
}

export type AuthServerMetadata = Record<string, unknown> & {
  issuer?: string
  registration_endpoint?: string
  authorization_endpoint?: string
  token_endpoint?: string
}

export class DcrError extends Error {
  constructor(
    readonly status: number,
    readonly error: string,
    readonly error_description: string,
  ) {
    super(error_description)
    this.name = 'DcrError'
  }

  toJson() {
    return { error: this.error, error_description: this.error_description }
  }
}

export function isSafeRedirectUri(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === 'https:') return true
  if (url.protocol !== 'http:') return false
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function sameRedirects(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((uri, i) => uri === right[i])
}

export function publicClient(authMethod: unknown) {
  return authMethod == null || authMethod === 'none'
}

export function toRfc7591Client(app: OAuthApplication, authMethod: string) {
  const issuedAt = Math.floor((app.createdAt || Date.now()) / 1000)
  return {
    client_id: app.clientId,
    ...(app.clientSecret ? { client_secret: app.clientSecret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: issuedAt,
    client_name: app.name,
    redirect_uris: app.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: authMethod,
    scope: app.scopes,
  }
}

export function withNestRegistration(
  metadata: AuthServerMetadata,
  origin: string,
): AuthServerMetadata {
  return {
    ...metadata,
    registration_endpoint: `${origin.replace(/\/$/, '')}/oauth/register`,
  }
}

export function asAuthServerMetadata(value: unknown): AuthServerMetadata {
  if (!value || typeof value !== 'object') return {}
  return { ...(value as AuthServerMetadata) }
}

@Injectable()
export class McpOAuthService {
  private readonly log = new Logger(McpOAuthService.name)
  private mode: OAuthMode = 'nest'
  private readonly registerHits = new Map<string, { windowStart: number; count: number }>()

  constructor(private readonly config: ConfigService) {}

  oauthMode() {
    return this.mode
  }

  publicOrigin() {
    return publicApiBase()
  }

  async discoverOAuthMode(): Promise<OAuthMode> {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY')
    if (!secretKey) {
      this.log.warn('CLERK_SECRET_KEY missing — MCP OAuth registration will 503')
      this.mode = 'nest'
      return this.mode
    }

    const clerkOn = await this.clerkHandlesClients(secretKey)
    this.mode = clerkOn ? 'clerk' : 'nest'
    this.log.log(
      clerkOn
        ? 'Clerk CIMD/DCR is advertised — MCP uses Clerk as the authorization server'
        : 'Clerk has no CIMD or DCR — Nest /oauth/register is the MCP registration endpoint',
    )
    return this.mode
  }

  async register(body: unknown, clientKey: string) {
    this.hitRegister(clientKey)
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY')
    if (!secretKey) {
      throw new DcrError(503, 'temporarily_unavailable', 'OAuth registration is not configured')
    }

    const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const redirectUris = asStringArray(input.redirect_uris)
    if (!redirectUris.length) {
      throw new DcrError(400, 'invalid_redirect_uri', 'redirect_uris is required')
    }
    if (!redirectUris.every(isSafeRedirectUri)) {
      throw new DcrError(400, 'invalid_redirect_uri', 'redirect_uris must be https or localhost')
    }

    const authMethod =
      typeof input.token_endpoint_auth_method === 'string'
        ? input.token_endpoint_auth_method
        : 'none'
    const allowedAuth = new Set(['none', 'client_secret_post', 'client_secret_basic'])
    if (!allowedAuth.has(authMethod)) {
      throw new DcrError(400, 'invalid_client_metadata', 'unsupported token_endpoint_auth_method')
    }

    const name =
      typeof input.client_name === 'string' && input.client_name.trim()
        ? input.client_name.trim().slice(0, 256)
        : 'Djanora MCP client'

    const clerk = createClerkClient({ secretKey })
    const existing = await this.findReusable(clerk, redirectUris, publicClient(authMethod))
    if (existing) return toRfc7591Client(existing, authMethod)

    try {
      const created = await clerk.oauthApplications.create({
        name,
        redirectUris,
        scopes: MCP_SCOPES,
        public: publicClient(authMethod),
      })
      return toRfc7591Client(created, authMethod)
    } catch (err) {
      this.log.warn(`OAuth client create failed: ${err instanceof Error ? err.message : 'unknown'}`)
      throw new DcrError(400, 'invalid_client_metadata', 'Could not register OAuth client')
    }
  }

  private async findReusable(
    clerk: ReturnType<typeof createClerkClient>,
    redirectUris: string[],
    isPublic: boolean,
  ) {
    try {
      const listed = await clerk.oauthApplications.list({ limit: 50 })
      return (
        listed.data.find(
          (app) => app.isPublic === isPublic && sameRedirects(app.redirectUris, redirectUris),
        ) ?? null
      )
    } catch {
      return null
    }
  }

  private hitRegister(clientKey: string) {
    const now = Date.now()
    const bucket = this.registerHits.get(clientKey)
    if (!bucket || now - bucket.windowStart >= REGISTER_WINDOW_MS) {
      this.registerHits.set(clientKey, { windowStart: now, count: 1 })
      return
    }
    bucket.count += 1
    if (bucket.count > REGISTER_LIMIT) {
      throw new DcrError(
        429,
        'invalid_request',
        'Too many registration attempts. Try again shortly.',
      )
    }
  }

  private async clerkHandlesClients(secretKey: string) {
    try {
      const res = await fetch(CLERK_OAUTH_SETTINGS, {
        headers: { Authorization: `Bearer ${secretKey}` },
      })
      if (!res.ok) return false
      const data = (await res.json()) as ClerkOAuthSettings
      if (data.client_id_metadata_documents_advertised || data.dynamic_oauth_client_registration) {
        return true
      }
    } catch (err) {
      this.log.warn(
        `Clerk OAuth settings read failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
    }
    return this.fromAuthServerMetadata()
  }

  private async fromAuthServerMetadata() {
    const publishableKey =
      this.config.get<string>('CLERK_PUBLISHABLE_KEY') ||
      this.config.get<string>('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
    if (!publishableKey) return false
    try {
      const { fetchClerkAuthorizationServerMetadata } = await import('@clerk/mcp-tools/server')
      const metadata = (await fetchClerkAuthorizationServerMetadata({ publishableKey })) as {
        client_id_metadata_document_supported?: boolean
        registration_endpoint?: string
      }
      return Boolean(
        metadata.client_id_metadata_document_supported || metadata.registration_endpoint,
      )
    } catch {
      return false
    }
  }
}
