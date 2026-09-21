import { Module } from '@nestjs/common'
import { EventAccessModule } from '../events/event-access.module'
import { UploadsModule } from '../uploads/uploads.module'
import { EventSitesController } from './event-sites.controller'
import { EventSitesPublicController } from './event-sites-public.controller'
import { EventSitesService } from './event-sites.service'

@Module({
  imports: [EventAccessModule, UploadsModule],
  controllers: [EventSitesController, EventSitesPublicController],
  providers: [EventSitesService],
  exports: [EventSitesService],
})
export class EventSitesModule {}
