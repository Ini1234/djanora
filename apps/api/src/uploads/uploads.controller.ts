import { Controller, Get, NotFoundException, Param, StreamableFile } from '@nestjs/common'
import { createReadStream, existsSync } from 'fs'
import { extname, join, resolve } from 'path'

const UPLOADS_DIR = resolve(process.cwd(), 'uploads')

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

@Controller('uploads')
export class UploadsController {
  @Get(':filename')
  serve(@Param('filename') filename: string) {
    if (
      !filename
      || filename.includes('..')
      || filename.includes('/')
      || filename.includes('\\')
      || filename.startsWith('receipt-')
    ) {
      throw new NotFoundException()
    }

    const diskPath = join(UPLOADS_DIR, filename)
    if (!diskPath.startsWith(UPLOADS_DIR) || !existsSync(diskPath)) {
      throw new NotFoundException()
    }

    return new StreamableFile(createReadStream(diskPath), {
      type: MIME[extname(filename).toLowerCase()] ?? 'application/octet-stream',
    })
  }
}
