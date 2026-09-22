import { NotFoundException } from '@nestjs/common'
import { UserRole } from '@prisma/client'
import type { PrismaService } from '../prisma/prisma.service'
import { liveUserWhere } from './active-user'

export async function requireAdminUser(prisma: PrismaService, clerkId: string) {
  const user = await prisma.user.findFirst({
    where: liveUserWhere(clerkId),
    select: { id: true, role: true, email: true },
  })
  if (user?.role !== UserRole.ADMIN) throw new NotFoundException('Not found')
  return user
}
