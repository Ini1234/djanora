import { PublicUploadService } from './public-upload.service'

describe('PublicUploadService', () => {
  it('404s filenames that are not a registered public image', async () => {
    const prisma = {
      eventSitePhoto: { findFirst: jest.fn().mockResolvedValue(null) },
      eventSite: { findFirst: jest.fn().mockResolvedValue(null) },
      inspirationItem: { findFirst: jest.fn().mockResolvedValue(null) },
      inspirationMedia: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new PublicUploadService(prisma as never)
    await expect(svc.isPublicImage('orphan.jpg')).resolves.toBe(false)
  })

  it('allows a site photo filename', async () => {
    const prisma = {
      eventSitePhoto: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      eventSite: { findFirst: jest.fn().mockResolvedValue(null) },
      inspirationItem: { findFirst: jest.fn().mockResolvedValue(null) },
      inspirationMedia: { findFirst: jest.fn().mockResolvedValue(null) },
    }
    const svc = new PublicUploadService(prisma as never)
    await expect(svc.isPublicImage('aabbcc.jpg')).resolves.toBe(true)
  })
})
