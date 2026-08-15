import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { EventMembersService } from './event-members.service'

@Controller('event-invites')
@UseGuards(ThrottlerGuard)
export class EventInvitesPublicController {
  constructor(private readonly membersService: EventMembersService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.membersService.previewByToken(token)
  }
}
