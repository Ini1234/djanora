import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { EventCommentSubject, EventSurface } from '@prisma/client'
import { EventsService } from './events.service'
import { EventBudgetService } from './event-budget.service'
import { EventChecklistService } from './event-checklist.service'
import { EventScheduleService } from './event-schedule.service'
import { EventPartyService } from './event-party.service'
import { EventMembersService } from './event-members.service'
import {
  CreatePartyMemberDto,
  ImportPartyDto,
  PairPartyMemberDto,
  UpdatePartyMemberDto,
} from './dto/party.dto'
import { EventCommentsService } from './event-comments.service'
import { EventActivityService } from './event-activity.service'
import { CreateEventDto } from './dto/create-event.dto'
import {
  CreateChecklistItemDto,
  ImportChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto'
import { CreateBudgetItemDto, UpdateBudgetItemDto, ImportBudgetDto } from './dto/budget.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { CreateScheduleItemDto, ImportScheduleDto, UpdateScheduleItemDto } from './dto/schedule.dto'
import { InviteMemberDto, UpdateMemberDto } from './dto/members.dto'
import {
  ApplyWeekendDto,
  AttachChildEventDto,
  CreateChildEventDto,
  ReorderChildrenDto,
} from './dto/children.dto'
import { CreateCommentDto, UpdateCommentDto } from './dto/comments.dto'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { BlobStorageService, makeUploadName } from '../uploads/blob-storage.service'
import { ThrottlerGuard } from '@nestjs/throttler'

interface ClerkPayload {
  sub: string
}

@Controller('events')
@UseGuards(ClerkAuthGuard)
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly budgetService: EventBudgetService,
    private readonly checklistService: EventChecklistService,
    private readonly scheduleService: EventScheduleService,
    private readonly partyService: EventPartyService,
    private readonly membersService: EventMembersService,
    private readonly commentsService: EventCommentsService,
    private readonly activityService: EventActivityService,
    private readonly storage: BlobStorageService,
  ) {}

  @Post()
  create(@CurrentUser() user: ClerkPayload, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.sub, dto)
  }

  @Get()
  findAll(@CurrentUser() user: ClerkPayload) {
    return this.eventsService.findByUser(user.sub)
  }

  @Get('invites')
  listPendingInvites(@CurrentUser() user: ClerkPayload) {
    return this.membersService.listPending(user.sub)
  }

  @Post('invites/:token/accept')
  acceptInvite(@CurrentUser() user: ClerkPayload, @Param('token') token: string) {
    return this.membersService.accept(user.sub, token)
  }

  // Nested :id/... routes MUST be registered before @Get(':id') / @Patch(':id').
  // Nest 11 + Express 5 otherwise treats PATCH /events/:id/checklist/:itemId as
  // an event update with a bogus id and returns 404.

  // ─── Checklist ────────────────────────────────────────────────────────────

  @Get(':id/checklist')
  listChecklist(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.checklistService.listChecklist(user.sub, eventId, assignedTo === 'me')
  }

  @Post(':id/checklist')
  addChecklistItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.checklistService.addChecklistItem(user.sub, eventId, dto)
  }

  @Post(':id/checklist/import')
  importChecklist(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ImportChecklistDto,
  ) {
    return this.checklistService.importChecklistItems(user.sub, eventId, dto)
  }

  @Patch(':id/checklist/:itemId')
  updateChecklistItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklistService.updateChecklistItem(user.sub, eventId, itemId, dto)
  }

  @Delete(':id/checklist/:itemId')
  deleteChecklistItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.checklistService.deleteChecklistItem(user.sub, eventId, itemId)
  }

  // ─── Schedule ─────────────────────────────────────────────────────────

  @Get(':id/schedule')
  listSchedule(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.scheduleService.listSchedule(user.sub, eventId)
  }

  @Post(':id/schedule')
  addScheduleItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreateScheduleItemDto,
  ) {
    return this.scheduleService.addScheduleItem(user.sub, eventId, dto)
  }

  @Post(':id/schedule/import')
  importSchedule(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ImportScheduleDto,
  ) {
    return this.scheduleService.importScheduleItems(user.sub, eventId, dto)
  }

  @Patch(':id/schedule/:itemId')
  updateScheduleItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateScheduleItemDto,
  ) {
    return this.scheduleService.updateScheduleItem(user.sub, eventId, itemId, dto)
  }

  @Delete(':id/schedule/:itemId')
  deleteScheduleItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.scheduleService.deleteScheduleItem(user.sub, eventId, itemId)
  }

  // ─── Wedding party ────────────────────────────────────────────────────────

  @Get(':id/party')
  listParty(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.partyService.list(user.sub, eventId)
  }

  @Post(':id/party')
  addPartyMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreatePartyMemberDto,
  ) {
    return this.partyService.add(user.sub, eventId, dto)
  }

  @Post(':id/party/import')
  importParty(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ImportPartyDto,
  ) {
    return this.partyService.importMembers(user.sub, eventId, dto)
  }

  @Patch(':id/party/:memberId')
  updatePartyMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdatePartyMemberDto,
  ) {
    return this.partyService.update(user.sub, eventId, memberId, dto)
  }

  @Delete(':id/party/:memberId')
  deletePartyMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.partyService.remove(user.sub, eventId, memberId)
  }

  @Post(':id/party/:memberId/pair')
  pairPartyMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
    @Body() dto: PairPartyMemberDto,
  ) {
    return this.partyService.pair(user.sub, eventId, memberId, dto.partnerId)
  }

  @Delete(':id/party/:memberId/pair')
  unpairPartyMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.partyService.unpair(user.sub, eventId, memberId)
  }

  @Post(':id/party/:memberId/photo')
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp']
        if (allowed.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Use a JPEG, PNG, or WebP photo'), false)
      },
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async partyPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('images', storedName, file.buffer, file.mimetype)
    return this.partyService.setPhoto(user.sub, eventId, memberId, storedName)
  }

  @Delete(':id/party/:memberId/photo')
  deletePartyPhoto(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.partyService.deletePhoto(user.sub, eventId, memberId)
  }

  // ─── Budget items ─────────────────────────────────────────────────────────

  @Get(':id/budget')
  listBudget(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.budgetService.listBudget(user.sub, eventId)
  }

  @Post(':id/budget')
  addBudgetItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreateBudgetItemDto,
  ) {
    return this.budgetService.addBudgetItem(user.sub, eventId, dto)
  }

  @Post(':id/budget/import')
  importBudget(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ImportBudgetDto,
  ) {
    return this.budgetService.importBudgetItems(user.sub, eventId, dto)
  }

  @Patch(':id/budget/:itemId')
  updateBudgetItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBudgetItemDto,
  ) {
    return this.budgetService.updateBudgetItem(user.sub, eventId, itemId, dto)
  }

  @Delete(':id/budget/:itemId')
  deleteBudgetItem(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.budgetService.deleteBudgetItem(user.sub, eventId, itemId)
  }

  // ─── Receipts ─────────────────────────────────────────────────────────────

  @Post(':id/budget/:itemId/receipts')
  @UseGuards(ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
        if (allowed.includes(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Only images and PDFs are allowed'), false)
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async addReceipt(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded')
    const storedName = makeUploadName(file.originalname)
    await this.storage.upload('receipts', storedName, file.buffer, file.mimetype)
    return this.budgetService.addReceipt(
      user.sub,
      eventId,
      itemId,
      file.originalname,
      `private/${storedName}`,
      file.mimetype,
      file.size,
    )
  }

  @Get(':id/budget/:itemId/receipts/:receiptId/file')
  async getReceiptFile(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('itemId') itemId: string,
    @Param('receiptId') receiptId: string,
  ) {
    const file = await this.budgetService.openReceiptFile(user.sub, eventId, itemId, receiptId)
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: `inline; filename="${file.filename.replace(/"/g, '')}"`,
    })
  }

  @Delete(':id/budget/:itemId/receipts/:receiptId')
  deleteReceipt(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('receiptId') receiptId: string,
  ) {
    return this.budgetService.deleteReceipt(user.sub, eventId, receiptId)
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  @Get(':id/members/mentionable')
  listMentionable(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Query('surface') surface?: EventSurface,
    @Query('includeSelf') includeSelf?: string,
  ) {
    return this.membersService.listMentionable(
      user.sub,
      eventId,
      surface,
      includeSelf === 'true' || includeSelf === '1',
    )
  }

  @Get(':id/members')
  listMembers(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.membersService.list(user.sub, eventId)
  }

  @Post(':id/members')
  @UseGuards(ThrottlerGuard)
  inviteMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.invite(user.sub, eventId, dto)
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(user.sub, eventId, memberId, dto)
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.remove(user.sub, eventId, memberId)
  }

  @Post(':id/leave')
  leaveEvent(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.membersService.leave(user.sub, eventId)
  }

  @Post(':id/weekend')
  applyWeekend(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ApplyWeekendDto,
  ) {
    return this.eventsService.applyWeekend(user.sub, eventId, dto)
  }

  @Post(':id/children')
  addChild(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreateChildEventDto,
  ) {
    return this.eventsService.addChild(user.sub, eventId, dto)
  }

  @Post(':id/children/attach')
  attachChild(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: AttachChildEventDto,
  ) {
    return this.eventsService.attachChild(user.sub, eventId, dto)
  }

  @Post(':id/children/reorder')
  reorderChildren(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: ReorderChildrenDto,
  ) {
    return this.eventsService.reorderChildren(user.sub, eventId, dto)
  }

  @Post(':id/children/:childId/detach')
  detachChild(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('childId') childId: string,
  ) {
    return this.eventsService.detachChild(user.sub, eventId, childId)
  }

  @Get(':id/activity')
  listActivity(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsed = parseInt(limit ?? '20', 10)
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 20
    return this.activityService.list(user.sub, eventId, {
      limit: take,
      cursor: cursor?.trim() || undefined,
    })
  }

  @Get(':id/unread')
  unreadCounts(@CurrentUser() user: ClerkPayload, @Param('id') eventId: string) {
    return this.activityService.unreadCounts(user.sub, eventId)
  }

  @Patch(':id/unread')
  markUnreadSeen(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() body: { surface?: string },
  ) {
    if (!body.surface) throw new BadRequestException('surface is required')
    return this.activityService.markSeen(user.sub, eventId, body.surface)
  }

  // ─── Comments ─────────────────────────────────────────────────────────────

  @Get(':id/comments')
  listComments(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Query('subjectType') subjectType: EventCommentSubject,
    @Query('subjectId') subjectId: string,
  ) {
    if (!subjectType || !subjectId)
      throw new BadRequestException('subjectType and subjectId are required')
    return this.commentsService.list(user.sub, eventId, subjectType, subjectId)
  }

  @Post(':id/comments')
  @UseGuards(ThrottlerGuard)
  createComment(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(user.sub, eventId, dto)
  }

  @Patch(':id/comments/:commentId')
  updateComment(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(user.sub, eventId, commentId, dto)
  }

  @Delete(':id/comments/:commentId')
  deleteComment(
    @CurrentUser() user: ClerkPayload,
    @Param('id') eventId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.commentsService.remove(user.sub, eventId, commentId)
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const event = await this.eventsService.findById(user.sub, id, assignedTo === 'me')
    if (!event) throw new NotFoundException('Event not found')
    return event
  }

  @Patch(':id')
  updateEvent(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(user.sub, id, dto)
  }

  @Delete(':id')
  softDelete(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.eventsService.softDelete(user.sub, id)
  }
}
