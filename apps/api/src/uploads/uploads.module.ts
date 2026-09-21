import { Module } from '@nestjs/common'
import { BlobStorageService } from './blob-storage.service'
import { PublicUploadService } from './public-upload.service'
import { UploadsController } from './uploads.controller'

@Module({
  controllers: [UploadsController],
  providers: [BlobStorageService, PublicUploadService],
  exports: [BlobStorageService],
})
export class UploadsModule {}
