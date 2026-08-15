import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { PrismaModule } from './prisma/prisma.module'
import { WebhooksModule } from './webhooks/webhooks.module'
import { UsersModule } from './users/users.module'
import { EventsModule } from './events/events.module'
import { NotificationsModule } from './notifications/notifications.module'
import { RemindersModule } from './reminders/reminders.module'
import { GuestsModule } from './guests/guests.module'
import { VendorsModule } from './vendors/vendors.module'
import { InquiriesModule } from './inquiries/inquiries.module'
import { VendorContactsModule } from './vendor-contacts/vendor-contacts.module'
import { SseModule } from './sse/sse.module'
import { InspirationModule } from './inspiration/inspiration.module'
import { UploadsModule } from './uploads/uploads.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 20 }],
    }),
    PrismaModule,
    WebhooksModule,
    UsersModule,
    EventsModule,
    NotificationsModule,
    RemindersModule,
    GuestsModule,
    VendorsModule,
    InquiriesModule,
    VendorContactsModule,
    SseModule,
    InspirationModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
