import { Module } from '@nestjs/common'
import { BlobStorageService } from './blob-storage.service'
import { UploadsController } from './uploads.controller'

@Module({
  controllers: [UploadsController],
  providers: [BlobStorageService],
  exports: [BlobStorageService],
})
export class UploadsModule {}
