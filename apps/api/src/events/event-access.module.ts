import { Module } from '@nestjs/common'
import { EventAccessRepository } from './event-access.repository'
import { EventAccessService } from './event-access.service'

@Module({
  providers: [EventAccessService, EventAccessRepository],
  exports: [EventAccessService],
})
export class EventAccessModule {}
