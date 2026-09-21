import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { EventSitesService } from './event-sites.service'
import { SiteRsvpDto, SiteSessionDto } from './dto/event-site.dto'
import { SESSION_HEADER } from './event-site.constants'

@Controller('event-sites')
@UseGuards(ThrottlerGuard)
export class EventSitesPublicController {
  constructor(private readonly sites: EventSitesService) {}

  @Get(':slug')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getPublic(@Param('slug') slug: string, @Headers(SESSION_HEADER) session?: string) {
    return this.sites.getPublic(slug, session)
  }

  @Post(':slug/session')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  session(@Param('slug') slug: string, @Body() dto: SiteSessionDto) {
    return this.sites.createSession(slug, dto)
  }

  @Post(':slug/rsvp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  rsvp(
    @Param('slug') slug: string,
    @Body() dto: SiteRsvpDto,
    @Headers(SESSION_HEADER) session?: string,
  ) {
    return this.sites.rsvp(slug, dto, session)
  }
}
