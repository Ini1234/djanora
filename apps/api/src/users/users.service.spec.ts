import { BadRequestException } from '@nestjs/common'
import { UsersService } from './users.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { ConfigService } from '@nestjs/config'
import type { EventAccessService } from '../events/event-access.service'

const unusedPrisma = {} as PrismaService
const unusedConfig = {} as ConfigService
const unusedAccess = {} as EventAccessService

describe('completeOnboarding role', () => {
  it('rejects ADMIN', async () => {
    const svc = new UsersService(unusedPrisma, unusedConfig, unusedAccess)
    await expect(
      svc.completeOnboarding('clerk_1', { role: 'ADMIN' } as unknown as {
        role: 'USER' | 'VENDOR'
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('ensureFromClerk', () => {
  it('returns the existing row without calling Clerk', async () => {
    const existing = { id: 'u1', clerkId: 'clerk_1', vendorProfile: null }
    const findUnique = jest.fn().mockResolvedValue(existing)
    const prisma = { user: { findUnique } } as unknown as PrismaService
    const svc = new UsersService(prisma, unusedConfig, unusedAccess)
    await expect(svc.ensureFromClerk('clerk_1')).resolves.toEqual(existing)
    expect(findUnique).toHaveBeenCalledWith({
      where: { clerkId: 'clerk_1' },
      include: { vendorProfile: true },
    })
  })
})
