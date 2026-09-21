import { Injectable, OnModuleInit } from '@nestjs/common'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpJobsService } from './mcp.jobs'
import { registerMcpTools } from './mcp.tools'

@Injectable()
export class McpRegistry implements OnModuleInit {
  readonly server = new McpServer({ name: 'djanora', version: '0.1.0' })

  constructor(private readonly jobs: McpJobsService) {}

  onModuleInit() {
    registerMcpTools(this.server, this.jobs)
  }
}
