import { NotFoundException } from '@nestjs/common'
import { InspirationService } from './inspiration.service'

describe('re-embed admin gate', () => {
  it('404s when the caller is not ADMIN', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'USER' }) },
    }
    const svc = new InspirationService(prisma as any, {} as any, {} as any, {} as any, {} as any)

    await expect(svc.requireAdmin('clerk_user')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.reEmbedAll('clerk_user')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.reEmbedVendors('clerk_user')).rejects.toBeInstanceOf(NotFoundException)
  })
})
