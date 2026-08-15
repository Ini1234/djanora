import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import { GuestsService } from './guests.service'
import { SubmitRsvpDto } from './dto/guests.dto'

@Controller('rsvp')
@UseGuards(ThrottlerGuard)
export class RsvpController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.guestsService.getInviteByToken(token)
  }

  @Post(':token')
  submitRsvp(@Param('token') token: string, @Body() dto: SubmitRsvpDto) {
    return this.guestsService.submitRsvp(token, dto)
  }
}
