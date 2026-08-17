import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { GuestsService } from './guests.service'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CreateGuestDto, UpdateGuestDto, SendInviteDto, BulkSendInviteDto } from './dto/guests.dto'

interface ClerkPayload {
  sub: string
}

@Controller('events/:eventId/guests')
@UseGuards(ClerkAuthGuard)
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  list(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.guestsService.listGuests(user.sub, eventId)
  }

  @Post()
  add(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Body() dto: CreateGuestDto,
  ) {
    return this.guestsService.addGuest(user.sub, eventId, dto)
  }

  @Patch(':guestId')
  update(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateGuestDto,
  ) {
    return this.guestsService.updateGuest(user.sub, eventId, guestId, dto)
  }

  @Delete(':guestId')
  remove(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
  ) {
    return this.guestsService.removeGuest(user.sub, eventId, guestId)
  }

  @Post(':guestId/invite')
  sendInvite(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Param('guestId') guestId: string,
    @Body() dto: SendInviteDto,
  ) {
    return this.guestsService.sendInvite(user.sub, eventId, guestId, dto)
  }

  @Post('bulk-invite')
  bulkInvite(
    @CurrentUser() user: ClerkPayload,
    @Param('eventId') eventId: string,
    @Body() dto: BulkSendInviteDto,
  ) {
    return this.guestsService.bulkSendInvites(user.sub, eventId, dto)
  }
}
