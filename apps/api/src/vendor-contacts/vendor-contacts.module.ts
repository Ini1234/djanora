import { Module } from '@nestjs/common'
import { VendorContactsController } from './vendor-contacts.controller'
import { VendorContactsService } from './vendor-contacts.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [VendorContactsController],
  providers: [VendorContactsService],
  exports: [VendorContactsService],
})
export class VendorContactsModule {}
