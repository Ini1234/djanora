import { NotFoundException } from '@nestjs/common'
import { liveUserWhere } from '../common/active-user'
import type { PrismaService } from '../prisma/prisma.service'

export async function requireInquiryParticipant(
  prisma: PrismaService,
  clerkId: string,
  inquiryId: string,
) {
  const user = await prisma.user.findFirst({
    where: liveUserWhere(clerkId),
    include: { vendorProfile: { select: { id: true, businessName: true } } },
  })
  if (!user) throw new NotFoundException('User not found')

  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, senderId: true, vendorProfileId: true },
  })
  if (!inquiry) throw new NotFoundException('Inquiry not found')

  const isVendor = !!(user.vendorProfile && inquiry.vendorProfileId === user.vendorProfile.id)
  const isParticipant = inquiry.senderId === user.id || isVendor
  if (!isParticipant) throw new NotFoundException('Inquiry not found')

  return { user, inquiry, isVendor }
}
