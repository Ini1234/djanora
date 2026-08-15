import { Module } from '@nestjs/common'
import { InquiriesController } from './inquiries.controller'
import { InquiriesService } from './inquiries.service'
import { PrismaModule } from '../prisma/prisma.module'
import { SseModule } from '../sse/sse.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [PrismaModule, SseModule, NotificationsModule, EventsModule],
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}
