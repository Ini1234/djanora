import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventInvitesPublicController } from './event-invites.controller'
import { EventsService } from './events.service'
import { EventAccessModule } from './event-access.module'
import { EventBudgetRepository } from './event-budget.repository'
import { EventBudgetService } from './event-budget.service'
import { EventChecklistRepository } from './event-checklist.repository'
import { EventChecklistService } from './event-checklist.service'
import { EventChildrenRepository } from './event-children.repository'
import { EventChildrenService } from './event-children.service'
import { EventScheduleRepository } from './event-schedule.repository'
import { EventScheduleService } from './event-schedule.service'
import { EventMembersService } from './event-members.service'
import { EventPartyService } from './event-party.service'
import { EventCommentsService } from './event-comments.service'
import { EventActivityService } from './event-activity.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'
import { SseModule } from '../sse/sse.module'
import { UploadsModule } from '../uploads/uploads.module'

@Module({
  imports: [NotificationsModule, UsersModule, SseModule, EventAccessModule, UploadsModule],
  controllers: [EventsController, EventInvitesPublicController],
  providers: [
    EventsService,
    EventBudgetService,
    EventBudgetRepository,
    EventChecklistService,
    EventChecklistRepository,
    EventScheduleService,
    EventScheduleRepository,
    EventChildrenService,
    EventChildrenRepository,
    EventMembersService,
    EventCommentsService,
    EventActivityService,
    EventPartyService,
  ],
  exports: [
    EventsService,
    EventAccessModule,
    EventActivityService,
    EventPartyService,
    EventMembersService,
    EventCommentsService,
  ],
})
export class EventsModule {}
