import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'
import { AdminService } from './admin.service'
import { ReviewReasonDto, SetUserRoleDto } from './admin.dto'

interface ClerkPayload {
  sub: string
}

@Controller('admin')
@UseGuards(ClerkAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('vendors')
  listVendors(
    @CurrentUser() user: ClerkPayload,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.admin.listVendors(user.sub, status, q)
  }

  @Get('vendors/:id')
  getVendor(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.admin.getVendor(user.sub, id)
  }

  @Post('vendors/:id/approve')
  approve(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.admin.approveVendor(user.sub, id)
  }

  @Post('vendors/:id/reject')
  reject(@CurrentUser() user: ClerkPayload, @Param('id') id: string, @Body() dto: ReviewReasonDto) {
    return this.admin.rejectVendor(user.sub, id, dto.reason.trim())
  }

  @Post('vendors/:id/suspend')
  suspend(
    @CurrentUser() user: ClerkPayload,
    @Param('id') id: string,
    @Body() dto: ReviewReasonDto,
  ) {
    return this.admin.suspendVendor(user.sub, id, dto.reason.trim())
  }

  @Post('vendors/:id/restore')
  restore(@CurrentUser() user: ClerkPayload, @Param('id') id: string) {
    return this.admin.restoreVendor(user.sub, id)
  }

  @Get('users')
  listUsers(
    @CurrentUser() user: ClerkPayload,
    @Query('q') q?: string,
    @Query('role') role?: string,
  ) {
    return this.admin.listUsers(user.sub, q, role)
  }

  @Post('users/:id/role')
  setRole(@CurrentUser() user: ClerkPayload, @Param('id') id: string, @Body() dto: SetUserRoleDto) {
    return this.admin.setUserRole(user.sub, id, dto.role)
  }
}
