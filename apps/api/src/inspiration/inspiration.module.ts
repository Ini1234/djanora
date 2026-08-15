import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InspirationController } from './inspiration.controller'
import { InspirationService } from './inspiration.service'
import { EmbeddingService } from './embedding.service'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { EventsModule } from '../events/events.module'

@Module({
  imports: [PrismaModule, ConfigModule, EventsModule, NotificationsModule],
  controllers: [InspirationController],
  providers: [InspirationService, EmbeddingService],
  exports: [InspirationService],
})
export class InspirationModule {}
