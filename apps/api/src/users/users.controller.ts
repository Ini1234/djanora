import { Controller, Get, Patch, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { UsersService } from './users.service'
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto'
import { UpdateMeDto } from './dto/update-me.dto'
import { SetModeDto } from './dto/set-mode.dto'
import { CreateUserChecklistDto, UpdateUserChecklistDto } from './dto/personal-checklist.dto'

interface ClerkPayload {
  sub: string
}

function parseLimit(limit: string | undefined, fallback: number) {
  const parsed = parseInt(limit ?? String(fallback), 10)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : fallback
}

@Controller('users')
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: ClerkPayload) {
    return this.usersService.ensureFromClerk(user.sub)
  }

  @Patch('me')
  updateMe(@CurrentUser() user: ClerkPayload, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.sub, dto)
  }

  @Patch('me/mode')
  setMode(@CurrentUser() user: ClerkPayload, @Body() dto: SetModeDto) {
    return this.usersService.setMode(user.sub, dto.mode)
  }

  @Patch('me/onboarding')
  completeOnboarding(@CurrentUser() user: ClerkPayload, @Body() dto: CompleteOnboardingDto) {
    return this.usersService.completeOnboarding(user.sub, dto)
  }

  @Get('me/checklists/due')
  listDueChecklists(
    @CurrentUser() user: ClerkPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.usersService.listDueChecklists(user.sub, {
      limit: parseLimit(limit, 8),
      cursor: cursor?.trim() || undefined,
    })
  }

  @Get('me/checklists')
  listChecklists(
    @CurrentUser() user: ClerkPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.usersService.listChecklists(user.sub, {
      limit: parseLimit(limit, 20),
      cursor: cursor?.trim() || undefined,
    })
  }

  @Post('me/checklists')
  createChecklist(@CurrentUser() user: ClerkPayload, @Body() dto: CreateUserChecklistDto) {
    return this.usersService.createChecklist(user.sub, dto)
  }

  @Patch('me/checklists/:id')
  updateChecklist(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserChecklistDto,
  ) {
    return this.usersService.updateChecklist(user.sub, id, dto)
  }

  @Delete('me/checklists/:id')
  deleteChecklist(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.usersService.deleteChecklist(user.sub, id)
  }
}
