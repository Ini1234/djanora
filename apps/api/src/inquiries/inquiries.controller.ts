import { Controller, Post, Get, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common'
import { InquiriesService } from './inquiries.service'
import { CreateInquiryDto } from './dto/create-inquiry.dto'
import { PostInquiryMessageDto } from './dto/post-inquiry-message.dto'
import { BookQuoteDto } from './dto/book-quote.dto'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'

@Controller('inquiries')
@UseGuards(ClerkAuthGuard)
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  /** Create a new inquiry — explicit user action only, never automatic. */
  @Post()
  create(@Request() req: any, @Body() dto: CreateInquiryDto) {
    return this.inquiriesService.createInquiry(req.userId, dto)
  }

  /** All inquiries received by the current user's vendor profile. */
  @Get('vendor')
  getVendorInquiries(@Request() req: any) {
    return this.inquiriesService.getVendorInquiries(req.userId)
  }

  /** Accept or decline an inquiry (vendor only). */
  @Patch(':id/status')
  updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.inquiriesService.updateInquiryStatus(req.userId, id, status)
  }

  /** List all inquiries sent by the current user, across all events. */
  @Get('me')
  getMyInquiries(@Request() req: any) {
    return this.inquiriesService.getMyInquiries(req.userId)
  }

  /** Get all messages in an inquiry thread (sender or vendor). */
  @Get(':id/messages')
  getMessages(@Request() req: any, @Param('id') id: string) {
    return this.inquiriesService.getMessages(req.userId, id)
  }

  /** Post a reply or vendor share card (sender or vendor). */
  @Post(':id/messages')
  postMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: PostInquiryMessageDto,
  ) {
    return this.inquiriesService.postMessage(req.userId, id, dto)
  }

  /** Host accepts a vendor quote. Not a booking. */
  @Post(':id/accept-quote')
  acceptQuote(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: BookQuoteDto,
  ) {
    return this.inquiriesService.acceptQuote(req.userId, id, dto.messageId)
  }

  /** Host rejects a vendor quote. Does not close the inquiry. */
  @Post(':id/reject-quote')
  rejectQuote(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: BookQuoteDto,
  ) {
    return this.inquiriesService.rejectQuote(req.userId, id, dto.messageId)
  }

  /** Host confirms they booked the person outside Djanora. */
  @Post(':id/book')
  bookQuote(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: BookQuoteDto,
  ) {
    return this.inquiriesService.bookQuote(req.userId, id, dto.messageId)
  }

  /** Mark messages from the other participant as read. */
  @Patch(':id/messages/read')
  markMessagesRead(@Request() req: any, @Param('id') id: string) {
    return this.inquiriesService.markMessagesRead(req.userId, id)
  }

  /** Edit a message authored by the current user within the edit window. */
  @Patch(':id/messages/:messageId')
  updateMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body('message') message: string,
  ) {
    return this.inquiriesService.updateMessage(req.userId, id, messageId, message)
  }

  /** Unsend a message authored by the current user within the 5-minute window. */
  @Delete(':id/messages/:messageId')
  unsendMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.inquiriesService.unsendMessage(req.userId, id, messageId)
  }

  /** List inquiries the current user has sent for a specific event. */
  @Get('event/:eventId')
  getForEvent(@Request() req: any, @Param('eventId') eventId: string) {
    return this.inquiriesService.getEventInquiries(req.userId, eventId)
  }
}
