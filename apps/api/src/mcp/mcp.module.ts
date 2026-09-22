import { Module } from '@nestjs/common'
import { EventSitesModule } from '../event-sites/event-sites.module'
import { EventAccessModule } from '../events/event-access.module'
import { EventsModule } from '../events/events.module'
import { GuestsModule } from '../guests/guests.module'
import { InquiriesModule } from '../inquiries/inquiries.module'
import { InspirationModule } from '../inspiration/inspiration.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { UploadsModule } from '../uploads/uploads.module'
import { UsersModule } from '../users/users.module'
import { VendorContactsModule } from '../vendor-contacts/vendor-contacts.module'
import { VendorsModule } from '../vendors/vendors.module'
import { McpBootstrap } from './mcp.bootstrap'
import { McpConfirmService } from './mcp.confirm.service'
import { McpOAuthService } from './mcp.oauth'
import { McpJobsService } from './mcp.jobs'
import { McpRateLimitService } from './mcp.rate-limit'
import { McpRegistry } from './mcp.registry'
import { McpScopeService } from './mcp.scope'
import { McpSessionService } from './mcp.session.service'

@Module({
  imports: [
    UsersModule,
    EventsModule,
    EventAccessModule,
    GuestsModule,
    EventSitesModule,
    InquiriesModule,
    InspirationModule,
    NotificationsModule,
    VendorsModule,
    VendorContactsModule,
    UploadsModule,
  ],
  providers: [
    McpSessionService,
    McpConfirmService,
    McpScopeService,
    McpRateLimitService,
    McpJobsService,
    McpOAuthService,
    McpRegistry,
    McpBootstrap,
  ],
  exports: [McpJobsService, McpSessionService, McpScopeService, McpConfirmService],
})
export class McpModule {}
