import { Injectable } from '@nestjs/common'
import { VendorCategory } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const BUDGET_ITEM_INCLUDE = {
  receipts: { orderBy: { createdAt: 'asc' as const } },
  userVendorContact: true,
} as const

@Injectable()
export class EventBudgetRepository {
  constructor(private prisma: PrismaService) {}

  listItems(eventId: string) {
    return this.prisma.eventBudgetItem.findMany({
      where: { eventId },
      orderBy: { category: 'asc' },
      include: BUDGET_ITEM_INCLUDE,
    })
  }

  findVendorProfileId(id: string) {
    return this.prisma.vendorProfile.findUnique({
      where: { id },
      select: { id: true },
    })
  }

  findUserContactId(id: string, userId: string) {
    return this.prisma.userVendorContact.findFirst({
      where: { id, userId },
      select: { id: true },
    })
  }

  createItem(data: {
    eventId: string
    category: VendorCategory
    label: string
    vendorName: string | null
    vendorProfileId: string | null
    userVendorContactId: string | null
    notes: string | null
    allocatedAmount: number
    spentAmount: number
  }) {
    return this.prisma.eventBudgetItem.create({
      data,
      include: { receipts: true, userVendorContact: true },
    })
  }

  listImportKeys(eventId: string) {
    return this.prisma.eventBudgetItem.findMany({
      where: { eventId },
      select: { category: true, label: true, vendorName: true },
    })
  }

  createMany(
    data: {
      eventId: string
      category: VendorCategory
      label: string
      vendorName: string | null
      notes: string | null
      allocatedAmount: number
      spentAmount: number
    }[],
  ) {
    return this.prisma.eventBudgetItem.createMany({ data })
  }

  findItemId(eventId: string, itemId: string) {
    return this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
      select: { id: true },
    })
  }

  findItem(eventId: string, itemId: string) {
    return this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
    })
  }

  findItemSummary(eventId: string, itemId: string) {
    return this.prisma.eventBudgetItem.findFirst({
      where: { id: itemId, eventId },
      select: { id: true, label: true, vendorName: true, category: true },
    })
  }

  updateItem(
    itemId: string,
    data: {
      label?: string
      vendorName?: string | null
      vendorProfileId?: string | null
      userVendorContactId?: string | null
      notes?: string | null
      allocatedAmount?: number
      spentAmount?: number
    },
  ) {
    return this.prisma.eventBudgetItem.update({
      where: { id: itemId },
      data,
      include: { receipts: true, userVendorContact: true },
    })
  }

  deleteItem(itemId: string) {
    return this.prisma.eventBudgetItem.delete({ where: { id: itemId } })
  }

  createReceipt(data: {
    budgetItemId: string
    filename: string
    url: string
    mimeType: string | null
    fileSize: number | null
  }) {
    return this.prisma.budgetReceipt.create({ data })
  }

  findReceiptForFile(eventId: string, itemId: string, receiptId: string) {
    return this.prisma.budgetReceipt.findFirst({
      where: { id: receiptId, budgetItemId: itemId, budgetItem: { eventId } },
    })
  }

  findReceipt(receiptId: string) {
    return this.prisma.budgetReceipt.findFirst({
      where: { id: receiptId },
      include: { budgetItem: true },
    })
  }

  deleteReceipt(receiptId: string) {
    return this.prisma.budgetReceipt.delete({ where: { id: receiptId } })
  }
}
