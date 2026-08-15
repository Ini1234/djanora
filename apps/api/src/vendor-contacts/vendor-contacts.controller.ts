import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common'
import { VendorContactsService } from './vendor-contacts.service'
import { CreateVendorContactDto, UpdateVendorContactDto } from './dto/vendor-contact.dto'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'

@Controller('vendor-contacts')
@UseGuards(ClerkAuthGuard)
export class VendorContactsController {
  constructor(private readonly service: VendorContactsService) {}

  @Get()
  findAll(@Request() req: any, @Query('category') category?: string) {
    return this.service.findAll(req.userId, category)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateVendorContactDto) {
    return this.service.create(req.userId, dto)
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVendorContactDto,
  ) {
    return this.service.update(req.userId, id, dto)
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(req.userId, id)
  }
}
