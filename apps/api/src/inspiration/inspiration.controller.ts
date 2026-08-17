import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { InspirationCategory } from '@prisma/client'
import { InspirationService } from './inspiration.service'
import { CreateInspirationDto } from './dto/create-inspiration.dto'
import { CreateInspirationCommentDto } from './dto/create-inspiration-comment.dto'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { InspirationSearchThrottleGuard } from '../common/guards/inspiration-search-throttle.guard'

interface ClerkPayload {
  sub: string
}

@Controller('inspiration')
export class InspirationController {
  constructor(private readonly svc: InspirationService) {}

  @Get()
  @UseGuards(InspirationSearchThrottleGuard)
  findAll(
    @Query('q') q?: string,
    @Query('category') category?: InspirationCategory,
    @Query('tag') tag?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? parseInt(limit) : undefined
    const slug = tag?.trim() || undefined
    if (q?.trim()) return this.svc.search(q, category, lim, slug)
    return this.svc.findAll(category, lim, slug)
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  create(@CurrentUser() user: ClerkPayload, @Body() dto: CreateInspirationDto) {
    return this.svc.create(user.sub, dto)
  }

  @Post('re-embed')
  @UseGuards(ClerkAuthGuard)
  reEmbed(@CurrentUser() user: ClerkPayload) {
    return this.svc.reEmbedAll(user.sub)
  }

  @Post('re-embed-vendors')
  @UseGuards(ClerkAuthGuard)
  reEmbedVendors(@CurrentUser() user: ClerkPayload) {
    return this.svc.reEmbedVendors(user.sub)
  }

  @Get('saved')
  @UseGuards(ClerkAuthGuard)
  getMySaved(@CurrentUser() user: ClerkPayload) {
    return this.svc.getMyMoodBoard(user.sub)
  }

  @Get('liked/ids')
  @UseGuards(ClerkAuthGuard)
  getLikedIds(@CurrentUser() user: ClerkPayload) {
    return this.svc.getLikedIds(user.sub)
  }

  @Get('liked')
  @UseGuards(ClerkAuthGuard)
  getLiked(@CurrentUser() user: ClerkPayload) {
    return this.svc.getLiked(user.sub)
  }

  @Get('tags')
  listTags() {
    return this.svc.listTags()
  }

  @Get(':id/matching-vendors')
  getMatchingVendors(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.svc.getMatchingVendors(id, limit ? parseInt(limit) : undefined)
  }

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.svc.listComments(id)
  }

  @Post(':id/comments')
  @UseGuards(ClerkAuthGuard)
  addComment(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: CreateInspirationCommentDto,
  ) {
    return this.svc.addComment(user.sub, id, dto.body)
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(ClerkAuthGuard)
  deleteComment(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
  ) {
    return this.svc.deleteComment(user.sub, id, commentId)
  }

  @Get('mood-board/:eventId')
  @UseGuards(ClerkAuthGuard)
  getMoodBoard(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.svc.getMoodBoard(user.sub, eventId)
  }

  @Get('mood-board/:eventId/ids')
  @UseGuards(ClerkAuthGuard)
  getSavedIds(@CurrentUser() user: ClerkPayload, @Param('eventId') eventId: string) {
    return this.svc.getSavedIds(user.sub, eventId)
  }

  @Get('mood-board/by-checklist/:checklistItemId')
  @UseGuards(ClerkAuthGuard)
  getMoodBoardByChecklist(
    @CurrentUser() user: ClerkPayload,
    @Param('checklistItemId') checklistItemId: string,
  ) {
    return this.svc.getMoodBoardByChecklist(user.sub, checklistItemId)
  }

  @Get('mood-board/by-budget/:budgetItemId')
  @UseGuards(ClerkAuthGuard)
  getMoodBoardByBudget(
    @CurrentUser() user: ClerkPayload,
    @Param('budgetItemId') budgetItemId: string,
  ) {
    return this.svc.getMoodBoardByBudget(user.sub, budgetItemId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { userId?: string }) {
    return this.svc.findOne(id, req.userId)
  }

  @Post(':id/save')
  @UseGuards(ClerkAuthGuard)
  save(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body()
    body: {
      eventId: string
      notes?: string
      checklistItemId?: string
      budgetItemId?: string
      scheduleItemId?: string
      scheduleItemIds?: string[]
    },
  ) {
    const scheduleItemIds =
      body.scheduleItemIds ?? (body.scheduleItemId ? [body.scheduleItemId] : undefined)
    return this.svc.saveToMoodBoard(
      user.sub,
      id,
      body.eventId,
      body.notes,
      body.checklistItemId,
      body.budgetItemId,
      scheduleItemIds,
    )
  }

  @Delete(':id/save')
  @UseGuards(ClerkAuthGuard)
  unsave(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Query('eventId') eventId: string,
  ) {
    return this.svc.removeFromMoodBoard(user.sub, id, eventId)
  }

  @Post(':id/like')
  @UseGuards(ClerkAuthGuard)
  like(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.svc.like(user.sub, id)
  }

  @Delete(':id/like')
  @UseGuards(ClerkAuthGuard)
  unlike(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.svc.unlike(user.sub, id)
  }
}
