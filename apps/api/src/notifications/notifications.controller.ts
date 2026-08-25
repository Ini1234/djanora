import { Controller, Get, Patch, Param, UseGuards, Query } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

interface ClerkPayload {
  sub: string
}

@Controller('notifications')
@UseGuards(ClerkAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: ClerkPayload, @Query('limit') limit?: string) {
    return this.notificationsService.findByUser(user.sub, limit ? parseInt(limit, 10) : 20)
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: ClerkPayload) {
    return this.notificationsService.markAllRead(user.sub)
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.notificationsService.markRead(user.sub, id)
  }
}
