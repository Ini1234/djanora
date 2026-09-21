import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import cors from 'cors'
import type { Application, RequestHandler } from 'express'
import { McpRegistry } from './mcp.registry'

@Injectable()
export class McpBootstrap implements OnModuleInit {
  private readonly log = new Logger(McpBootstrap.name)

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly registry: McpRegistry,
  ) {}

  async onModuleInit() {
    if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    }

    const [{ clerkMiddleware }, clerkMcp] = await Promise.all([
      import('@clerk/express'),
      import('@clerk/mcp-tools/express'),
    ])

    const app: Application = this.adapterHost.httpAdapter.getInstance()
    const mcpCors = cors({
      origin: true,
      exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
    })
    const resource = clerkMcp.protectedResourceHandlerClerk({
      scopes_supported: ['email', 'profile', 'openid'],
    })
    const mcp = clerkMcp.streamableHttpHandler(this.registry.server as never)

    app.use('/.well-known', mcpCors as RequestHandler)
    app.get('/.well-known/oauth-protected-resource', resource)
    app.get('/.well-known/oauth-protected-resource/mcp', resource)
    app.get('/.well-known/oauth-authorization-server', clerkMcp.authServerMetadataHandlerClerk)

    app.use('/mcp', mcpCors as RequestHandler, clerkMiddleware(), clerkMcp.mcpAuthClerk)
    app.post('/mcp', mcp)
    app.get('/mcp', mcp)
    app.delete('/mcp', mcp)

    this.log.log('MCP listening on /mcp')
  }
}
