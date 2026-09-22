import { Module } from '@nestjs/common'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { EventAccessModule } from '../events/event-access.module'
import { McpModule } from '../mcp/mcp.module'
import { UploadsModule } from '../uploads/uploads.module'
import { UsersModule } from '../users/users.module'
import { AssistantAgentService } from './assistant.agent'
import { AssistantAzureService } from './assistant.azure'
import { AssistantController } from './assistant.controller'
import { AssistantNavigateService } from './assistant.navigate'
import { AssistantRateLimitService } from './assistant.rate-limit'
import { AssistantService } from './assistant.service'

@Module({
  imports: [UsersModule, EventAccessModule, McpModule, UploadsModule],
  controllers: [AssistantController],
  providers: [
    ClerkAuthGuard,
    AssistantAzureService,
    AssistantRateLimitService,
    AssistantNavigateService,
    AssistantAgentService,
    AssistantService,
  ],
})
export class AssistantModule {}
