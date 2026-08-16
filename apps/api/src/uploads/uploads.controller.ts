import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common'
import { extname } from 'path'
import { BlobStorageService, isSafeName } from './blob-storage.service'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: BlobStorageService) {}

  @Get(':filename')
  async serve(@Param('filename') filename: string) {
    if (!isSafeName(filename) || filename.startsWith('receipt-')) {
      throw new NotFoundException()
    }

    const stream = await this.storage.download('images', filename)
    if (!stream) throw new NotFoundException()

    return new StreamableFile(stream, {
      type: MIME[extname(filename).toLowerCase()] ?? 'application/octet-stream',
    })
  }
}
