import { NotFoundException } from '@nestjs/common'
import { requireInquiryParticipant } from './inquiry-access'

function prismaMock(opts: {
  user?: { id: string; vendorProfile: { id: string; businessName: string } | null } | null
  inquiry?: { id: string; senderId: string; vendorProfileId: string } | null
}) {
  return {
    user: { findFirst: jest.fn().mockResolvedValue(opts.user ?? null) },
    inquiry: { findUnique: jest.fn().mockResolvedValue(opts.inquiry ?? null) },
  }
}

describe('requireInquiryParticipant', () => {
  it('allows the sender', async () => {
    const prisma = prismaMock({
      user: { id: 'u1', vendorProfile: null },
      inquiry: { id: 'i1', senderId: 'u1', vendorProfileId: 'v1' },
    })
    const out = await requireInquiryParticipant(prisma as never, 'clerk', 'i1')
    expect(out.isVendor).toBe(false)
    expect(out.inquiry.id).toBe('i1')
  })

  it('hides the thread from strangers', async () => {
    const prisma = prismaMock({
      user: { id: 'u2', vendorProfile: null },
      inquiry: { id: 'i1', senderId: 'u1', vendorProfileId: 'v1' },
    })
    await expect(requireInquiryParticipant(prisma as never, 'clerk', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
