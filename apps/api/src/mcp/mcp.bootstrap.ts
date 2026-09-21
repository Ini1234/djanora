import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import cors from 'cors'
import type { Application, Request, RequestHandler, Response } from 'express'
import { streamableHttpHandler } from './mcp.http'
import { asAuthServerMetadata, DcrError, McpOAuthService, withNestRegistration } from './mcp.oauth'
import { McpRegistry } from './mcp.registry'

@Injectable()
export class McpBootstrap implements OnModuleInit {
  private readonly log = new Logger(McpBootstrap.name)

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly registry: McpRegistry,
    private readonly oauth: McpOAuthService,
  ) {}

  async onModuleInit() {
    if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      process.env.CLERK_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    }

    const [{ clerkMiddleware }, clerkMcp, clerkServer] = await Promise.all([
      import('@clerk/express'),
      import('@clerk/mcp-tools/express'),
      import('@clerk/mcp-tools/server'),
    ])

    const oauthMode = await this.oauth.discoverOAuthMode()
    const origin = this.oauth.publicOrigin()
    const app: Application = this.adapterHost.httpAdapter.getInstance()
    const mcpCors = cors({
      origin: true,
      credentials: true,
      exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
    })
    const resource = clerkMcp.protectedResourceHandlerClerk({
      scopes_supported: ['email', 'profile', 'openid'],
    })
    const authServer: RequestHandler = async (_req: Request, res: Response) => {
      const publishableKey = process.env.CLERK_PUBLISHABLE_KEY
      if (!publishableKey) throw new Error('CLERK_PUBLISHABLE_KEY environment variable is required')
      const metadata = asAuthServerMetadata(
        (await clerkServer.fetchClerkAuthorizationServerMetadata({
          publishableKey,
        })) as unknown,
      )
      if (oauthMode === 'clerk') {
        res.json(metadata)
        return
      }
      res.json(withNestRegistration(metadata, origin))
    }
    const register: RequestHandler = async (req, res) => {
      try {
        const client = await this.oauth.register(req.body, req.ip ?? 'unknown')
        res.status(201).json(client)
      } catch (err) {
        if (err instanceof DcrError) {
          res.status(err.status).json(err.toJson())
          return
        }
        this.log.warn(`OAuth register failed: ${err instanceof Error ? err.message : 'unknown'}`)
        res.status(500).json({ error: 'server_error', error_description: 'Registration failed' })
      }
    }
    const mcp = streamableHttpHandler(this.registry)

    app.use('/.well-known', mcpCors as RequestHandler)
    app.get('/.well-known/oauth-protected-resource', resource)
    app.get('/.well-known/oauth-protected-resource/mcp', resource)
    app.get('/.well-known/oauth-authorization-server', authServer)
    app.get('/.well-known/oauth-authorization-server/mcp', authServer)
    if (oauthMode === 'nest') {
      app.options('/oauth/register', mcpCors as RequestHandler)
      app.post('/oauth/register', mcpCors as RequestHandler, register)
    }

    app.use('/mcp', mcpCors as RequestHandler, clerkMiddleware(), clerkMcp.mcpAuthClerk)
    app.post('/mcp', mcp)
    app.get('/mcp', mcp)
    app.delete('/mcp', mcp)

    this.log.log(`MCP listening on /mcp (OAuth: ${oauthMode})`)
  }
}
