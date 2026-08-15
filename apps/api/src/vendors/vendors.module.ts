import { Module } from '@nestjs/common'
import { VendorsController } from './vendors.controller'
import { VendorsService } from './vendors.service'
import { VendorPostsService } from './vendor-posts.service'
import { PrismaModule } from '../prisma/prisma.module'
import { ClerkAuthGuard } from '../common/guards/clerk-auth.guard'

@Module({
  imports: [PrismaModule],
  controllers: [VendorsController],
  providers: [VendorsService, VendorPostsService, ClerkAuthGuard],
  exports: [VendorsService],
})
export class VendorsModule {}
