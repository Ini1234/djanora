import { BadRequestException, NotFoundException } from '@nestjs/common'
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

describe('upsert', () => {
  it('does not revive a soft-deleted user from Clerk', async () => {
    const existing = { id: 'u1', clerkId: 'clerk_1', deletedAt: new Date() }
    const findUnique = jest.fn().mockResolvedValue(existing)
    const upsert = jest.fn()
    const prisma = { user: { findUnique, upsert }, eventMember: { updateMany: jest.fn() } }
    const svc = new UsersService(prisma as never, unusedConfig, unusedAccess)
    await expect(svc.upsert({ clerkId: 'clerk_1', email: 'back@example.com' })).resolves.toEqual(
      existing,
    )
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('softDelete', () => {
  it('tombstones the email and suspends the vendor profile', async () => {
    const existing = { id: 'u1', clerkId: 'clerk_1', deletedAt: null }
    const updated = { ...existing, deletedAt: new Date(), email: 'deleted+u1@invalid.local' }
    const tx = {
      user: { update: jest.fn().mockResolvedValue(updated) },
      vendorProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    }
    const svc = new UsersService(prisma as never, unusedConfig, unusedAccess)
    await expect(svc.softDelete('clerk_1')).resolves.toEqual(updated)
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { deletedAt: expect.any(Date), email: 'deleted+u1@invalid.local' },
    })
    expect(tx.vendorProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { reviewStatus: 'SUSPENDED', isVerified: false, isActive: false },
    })
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
      include: {
        vendorProfile: {
          select: expect.not.objectContaining({ embedding: true }),
        },
      },
    })
    expect(findUnique.mock.calls[0][0].include.vendorProfile.select.embedding).toBeUndefined()
  })

  it('does not revive a soft-deleted user from Clerk (FR-24)', async () => {
    const existing = { id: 'u1', clerkId: 'clerk_1', deletedAt: new Date(), vendorProfile: null }
    const findUnique = jest.fn().mockResolvedValue(existing)
    const upsert = jest.fn()
    const prisma = { user: { findUnique, upsert } } as unknown as PrismaService
    const svc = new UsersService(prisma, unusedConfig, unusedAccess)
    await expect(svc.ensureFromClerk('clerk_1')).rejects.toBeInstanceOf(NotFoundException)
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('listChecklists assigned access', () => {
  it('loads event access once per event, not once per item', async () => {
    const loadMany = jest.fn().mockResolvedValue(
      new Map([
        [
          'e1',
          {
            isHost: true,
            role: 'HOST',
            surfaces: ['CHECKLIST'],
          },
        ],
      ]),
    )
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c' }) },
      userChecklist: { findMany: jest.fn().mockResolvedValue([]) },
      eventChecklist: {
        findMany: jest.fn().mockResolvedValue([checklistRow('c1', 'e1'), checklistRow('c2', 'e1')]),
      },
    }
    const access = {
      loadMany,
      canSee: () => true,
      canSeeChecklistRow: () => true,
    }
    const svc = new UsersService(prisma as never, unusedConfig, access as never)
    const result = await svc.listChecklists('clerk_1')
    expect(loadMany).toHaveBeenCalledTimes(1)
    expect(loadMany).toHaveBeenCalledWith('clerk_1', ['e1'])
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
