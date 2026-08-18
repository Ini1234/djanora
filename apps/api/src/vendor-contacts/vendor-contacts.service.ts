import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { VendorCategory } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateVendorContactDto, UpdateVendorContactDto } from './dto/vendor-contact.dto'

function parseVendorCategory(value?: string): VendorCategory | undefined {
  if (!value) return undefined
  return (Object.values(VendorCategory) as string[]).includes(value)
    ? (value as VendorCategory)
    : undefined
}

@Injectable()
export class VendorContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUser(clerkId: string) {
    const user = await this.prisma.user.findUnique({ where: { clerkId } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async findAll(clerkId: string, category?: string) {
    const user = await this.resolveUser(clerkId)
    const parsedCategory = parseVendorCategory(category)
    return this.prisma.userVendorContact.findMany({
      where: {
        userId: user.id,
        ...(parsedCategory ? { category: parsedCategory } : {}),
      },
      include: {
        vendorProfile: {
          select: { id: true, slug: true, isVerified: true, averageRating: true },
        },
      },
      orderBy: [{ name: 'asc' }],
    })
  }

  async create(clerkId: string, dto: CreateVendorContactDto) {
    const user = await this.resolveUser(clerkId)
    return this.prisma.userVendorContact.create({
      data: {
        userId: user.id,
        name: dto.name,
        category: dto.category ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        website: dto.website ?? null,
        notes: dto.notes ?? null,
      },
    })
  }

  async update(clerkId: string, contactId: string, dto: UpdateVendorContactDto) {
    const user = await this.resolveUser(clerkId)
    const contact = await this.prisma.userVendorContact.findUnique({ where: { id: contactId } })
    if (!contact) throw new NotFoundException('Contact not found')
    if (contact.userId !== user.id) throw new ForbiddenException()

    return this.prisma.userVendorContact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    })
  }

  async remove(clerkId: string, contactId: string) {
    const user = await this.resolveUser(clerkId)
    const contact = await this.prisma.userVendorContact.findUnique({ where: { id: contactId } })
    if (!contact) throw new NotFoundException('Contact not found')
    if (contact.userId !== user.id) throw new ForbiddenException()

    await this.prisma.userVendorContact.delete({ where: { id: contactId } })
    return { ok: true }
  }

  /** Find or create a contact by name for the current user (used during budget saves). */
  async upsertByName(clerkId: string, dto: CreateVendorContactDto) {
    const user = await this.resolveUser(clerkId)

    const existing = await this.prisma.userVendorContact.findFirst({
      where: { userId: user.id, name: { equals: dto.name, mode: 'insensitive' } },
    })

    if (existing) {
      // Update any newly provided fields
      return this.prisma.userVendorContact.update({
        where: { id: existing.id },
        data: {
          ...(dto.email && { email: dto.email }),
          ...(dto.phone && { phone: dto.phone }),
          ...(dto.website && { website: dto.website }),
          ...(dto.category && { category: dto.category }),
          ...(dto.notes && { notes: dto.notes }),
        },
      })
    }

    return this.create(clerkId, dto)
  }
}
