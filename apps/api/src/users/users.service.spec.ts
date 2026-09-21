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

describe('listChecklists assigned access', () => {
  it('loads event access once per event, not once per item', async () => {
    const load = jest.fn().mockResolvedValue({
      isHost: true,
      role: 'HOST',
      surfaces: ['CHECKLIST'],
    })
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c' }) },
      userChecklist: { findMany: jest.fn().mockResolvedValue([]) },
      eventChecklist: {
        findMany: jest.fn().mockResolvedValue([checklistRow('c1', 'e1'), checklistRow('c2', 'e1')]),
      },
    }
    const access = {
      load,
      canSee: () => true,
      canSeeChecklistRow: () => true,
    }
    const svc = new UsersService(prisma as never, unusedConfig, access as never)
    const result = await svc.listChecklists('clerk_1')
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('clerk_1', 'e1')
    expect(result.items).toHaveLength(2)
  })
})

function checklistRow(id: string, eventId: string) {
  const now = new Date('2026-09-17T00:00:00.000Z')
  return {
    id,
    title: id,
    isCompleted: false,
    dueDate: null,
    eventId,
    createdAt: now,
    updatedAt: now,
    event: { id: eventId, title: 'Wedding' },
    concealments: [],
  }
}
