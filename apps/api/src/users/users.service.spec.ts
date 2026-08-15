import { BadRequestException } from '@nestjs/common'
import { UsersService } from './users.service'

describe('completeOnboarding role', () => {
  it('rejects ADMIN', async () => {
    const svc = new UsersService({} as any, {} as any, {} as any)
    await expect(
      svc.completeOnboarding('clerk_1', { role: 'ADMIN' } as any),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
