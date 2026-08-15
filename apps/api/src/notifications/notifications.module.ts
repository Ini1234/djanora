import { Module } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationDeliveryService } from './notification-delivery.service'
import { SseModule } from '../sse/sse.module'

@Module({
  imports: [SseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationDeliveryService],
  exports: [NotificationsService, NotificationDeliveryService],
})
export class NotificationsModule {}
