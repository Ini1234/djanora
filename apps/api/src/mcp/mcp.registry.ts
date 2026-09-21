import { Injectable } from '@nestjs/common'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpJobsService } from './mcp.jobs'
import { registerMcpTools } from './mcp.tools'

@Injectable()
export class McpRegistry {
  constructor(private readonly jobs: McpJobsService) {}

  createServer() {
    const server = new McpServer({ name: 'djanora', version: '0.1.0' })
    registerMcpTools(server, this.jobs)
    return server
  }
}
