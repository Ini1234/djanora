import { Module } from '@nestjs/common'
import { EventAccessService } from './event-access.service'

@Module({
  providers: [EventAccessService],
  exports: [EventAccessService],
})
export class EventAccessModule {}
