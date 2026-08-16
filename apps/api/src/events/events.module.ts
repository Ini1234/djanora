import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventInvitesPublicController } from './event-invites.controller'
import { EventsService } from './events.service'
import { EventAccessModule } from './event-access.module'
import { EventMembersService } from './event-members.service'
import { EventCommentsService } from './event-comments.service'
import { EventActivityService } from './event-activity.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'
import { SseModule } from '../sse/sse.module'
import { UploadsModule } from '../uploads/uploads.module'

@Module({
  imports: [NotificationsModule, UsersModule, SseModule, EventAccessModule, UploadsModule],
  controllers: [EventsController, EventInvitesPublicController],
  providers: [EventsService, EventMembersService, EventCommentsService, EventActivityService],
  exports: [EventsService, EventAccessModule, EventActivityService],
})
export class EventsModule {}
