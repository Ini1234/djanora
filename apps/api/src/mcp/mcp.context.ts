import { randomBytes } from 'node:crypto'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js'
import { mcpError } from './mcp.errors'

export type McpCtx = {
  clerkId: string
  sessionId: string
}

export function mcpCtx(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): McpCtx {
  const clerkId =
    (typeof extra.authInfo?.extra?.userId === 'string' && extra.authInfo.extra.userId) ||
    (typeof extra.authInfo?.extra?.sub === 'string' && extra.authInfo.extra.sub) ||
    ''
  if (!clerkId) mcpError('unauthorized', 'Sign in with your Djanora account')
  const sessionId =
    extra.sessionId?.trim() || `ephemeral:${clerkId}:${randomBytes(8).toString('hex')}`
  return { clerkId, sessionId }
}
