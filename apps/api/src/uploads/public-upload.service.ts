import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PublicUploadService {
  constructor(private readonly prisma: PrismaService) {}

  async isPublicImage(filename: string) {
    const needle = `/${filename}`
    const stored = `uploads/${filename}`
    const [photo, cover, inspiration, media] = await Promise.all([
      this.prisma.eventSitePhoto.findFirst({ where: { filename }, select: { id: true } }),
      this.prisma.eventSite.findFirst({ where: { coverPhotoKey: filename }, select: { id: true } }),
      this.prisma.inspirationItem.findFirst({
        where: {
          OR: [{ imageUrl: filename }, { imageUrl: stored }, { imageUrl: { endsWith: needle } }],
        },
        select: { id: true },
      }),
      this.prisma.inspirationMedia.findFirst({
        where: { OR: [{ url: filename }, { url: stored }, { url: { endsWith: needle } }] },
        select: { id: true },
      }),
    ])
    return Boolean(photo || cover || inspiration || media)
  }
}
