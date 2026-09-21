import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import {
  ConfirmAssistantJobDto,
  CreateAssistantThreadDto,
  PatchAssistantThreadDto,
  PostAssistantMessageDto,
} from './assistant.dto'
import { AssistantAzureService } from './assistant.azure'
import { AssistantService } from './assistant.service'

interface ClerkPayload {
  sub: string
}

@Controller('assistant')
@UseGuards(ClerkAuthGuard, ThrottlerGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly azure: AssistantAzureService,
  ) {}

  @Get('status')
  status() {
    return { configured: this.azure.isConfigured }
  }

  @Get('threads')
  list(@CurrentUser() user: ClerkPayload) {
    return this.assistant.listThreads(user.sub)
  }

  @Post('threads')
  create(@CurrentUser() user: ClerkPayload, @Body() dto: CreateAssistantThreadDto) {
    return this.assistant.createThread(user.sub, dto.eventId)
  }

  @Get('threads/:id')
  get(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.assistant.getThread(user.sub, id)
  }

  @Patch('threads/:id')
  patch(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: PatchAssistantThreadDto,
  ) {
    return this.assistant.setThreadEvent(user.sub, id, dto.eventId)
  }

  @Delete('threads/:id')
  remove(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.assistant.deleteThread(user.sub, id)
  }

  @Post('threads/:id/messages')
  message(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: PostAssistantMessageDto,
  ) {
    return this.assistant.postMessage(user.sub, id, dto.content, dto.pageContext)
  }

  @Post('threads/:id/confirm')
  confirm(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: ConfirmAssistantJobDto,
  ) {
    return this.assistant.confirmJob(user.sub, id, {
      tool: dto.tool,
      args: dto.args,
      confirmToken: dto.confirmToken,
    })
  }
}
