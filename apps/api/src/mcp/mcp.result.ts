import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { nestToMcp, type McpErrorBody } from './mcp.errors'

export function okJson(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

export function errJson(body: McpErrorBody): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(body) }] }
}

export function catchJob(err: unknown): CallToolResult {
  return errJson(nestToMcp(err))
}
