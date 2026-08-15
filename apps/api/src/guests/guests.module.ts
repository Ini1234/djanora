import { Module } from '@nestjs/common'
import { GuestsController } from './guests.controller'
import { RsvpController } from './rsvp.controller'
import { GuestsService } from './guests.service'
import { NotificationsModule } from '../notifications/notifications.module'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [NotificationsModule, EventsModule],
  controllers: [GuestsController, RsvpController],
  providers: [GuestsService],
})
export class GuestsModule {}
