import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestHandler } from 'express'
import type { McpRegistry } from './mcp.registry'

type McpIncoming = IncomingMessage & { auth?: AuthInfo; body?: unknown }

/**
 * Clerk's streamableHttpHandler connects one McpServer to a new transport on
 * every request. The SDK only allows one transport per Protocol instance, so
 * Claude's second POST (/initialize then tools/list) throws "Already connected".
 * Stateless Streamable HTTP: new server + transport per request.
 */
export function streamableHttpHandler(registry: McpRegistry): RequestHandler {
  return async (req, res) => {
    const server = registry.createServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      void transport.close()
      void server.close()
    }
    res.on('close', close)
    try {
      await server.connect(transport)
      await transport.handleRequest(req as McpIncoming, res as ServerResponse, req.body)
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        })
      }
    }
  }
}
