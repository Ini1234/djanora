import { Injectable, NotFoundException } from '@nestjs/common'
import { basename } from 'path'
import { EventActivityAction, EventSurface, VendorCategory } from '@prisma/client'
import { BlobStorageService } from '../uploads/blob-storage.service'
import { asOptionalString, asRecord, foldKey, requiredLabel } from './event-helpers'
import { receiptProxyUrl, rewriteReceiptUrls } from './event-receipts'
import { EventAccessService } from './event-access.service'
import { EventActivityService } from './event-activity.service'
import { EventBudgetRepository } from './event-budget.repository'
import type { CreateBudgetItemDto, ImportBudgetDto, UpdateBudgetItemDto } from './dto/budget.dto'

@Injectable()
export class EventBudgetService {
  constructor(
    private repo: EventBudgetRepository,
    private access: EventAccessService,
    private activity: EventActivityService,
    private storage: BlobStorageService,
  ) {}

  async listBudget(clerkId: string, eventId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'view' })
    const items = await this.repo.listItems(eventId)
    return rewriteReceiptUrls(eventId, items)
  }

  async addBudgetItem(clerkId: string, eventId: string, dto: CreateBudgetItemDto) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.BUDGET,
      action: 'edit',
    })
    const safeVendorProfileId = dto.vendorProfileId
      ? ((await this.repo.findVendorProfileId(dto.vendorProfileId))?.id ?? null)
      : null
    const safeContactId = dto.userVendorContactId
      ? ((await this.repo.findUserContactId(dto.userVendorContactId, user.id))?.id ?? null)
      : null
    const created = await this.repo.createItem({
      eventId,
      category: dto.category,
      label: requiredLabel(dto.label),
      vendorName: dto.vendorName ?? null,
      vendorProfileId: safeVendorProfileId,
      userVendorContactId: safeContactId,
      notes: dto.notes ?? null,
      allocatedAmount: dto.allocatedAmount,
      spentAmount: dto.spentAmount ?? 0,
    })
    this.track(
      eventId,
      user.id,
      EventActivityAction.CREATED,
      `Added budget item “${created.label || created.vendorName || created.category}”`,
      created.id,
    )
    return created
  }

  async importBudgetItems(clerkId: string, eventId: string, dto: ImportBudgetDto) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.BUDGET,
      action: 'edit',
    })
    const existing = await this.repo.listImportKeys(eventId)
    const seen = new Set(
      existing.map(
        (row) =>
          `${row.category}|${(row.label ?? '').trim().toLowerCase()}|${(row.vendorName ?? '').trim().toLowerCase()}`,
      ),
    )
    const toCreate: {
      eventId: string
      category: VendorCategory
      label: string
      vendorName: string | null
      notes: string | null
      allocatedAmount: number
      spentAmount: number
    }[] = []
    let skipped = 0
    const rawItems: unknown[] = Array.isArray(asRecord(dto).items)
      ? (asRecord(dto).items as unknown[])
      : []
    for (const raw of rawItems) {
      const item = asRecord(raw)
      const category = item.category
      if (typeof category !== 'string' || !(category in VendorCategory)) continue
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      if (!label) {
        skipped += 1
        continue
      }
      const vendorName = asOptionalString(item.vendorName)
      const key = `${category}|${foldKey(label)}|${foldKey(vendorName)}`
      if (seen.has(key)) {
        skipped += 1
        continue
      }
      seen.add(key)
      const allocatedAmount =
        typeof item.allocatedAmount === 'number'
          ? item.allocatedAmount
          : Number(item.allocatedAmount)
      const spentAmount =
        typeof item.spentAmount === 'number' ? item.spentAmount : Number(item.spentAmount ?? 0)
      if (!Number.isFinite(allocatedAmount)) continue
      toCreate.push({
        eventId,
        category: category as VendorCategory,
        label,
        vendorName,
        notes: asOptionalString(item.notes),
        allocatedAmount,
        spentAmount: Number.isFinite(spentAmount) ? spentAmount : 0,
      })
    }
    if (toCreate.length > 0) {
      await this.repo.createMany(toCreate)
      this.track(
        eventId,
        user.id,
        EventActivityAction.CREATED,
        `Imported ${toCreate.length} budget item${toCreate.length === 1 ? '' : 's'}`,
      )
    }
    const items = await this.listBudget(clerkId, eventId)
    return { created: toCreate.length, skipped, items }
  }

  async updateBudgetItem(
    clerkId: string,
    eventId: string,
    itemId: string,
    dto: UpdateBudgetItemDto,
  ) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.BUDGET,
      action: 'edit',
    })
    const existing = await this.repo.findItemId(eventId, itemId)
    if (!existing) throw new NotFoundException('Budget item not found')

    let safeVendorProfileId: string | null | undefined
    if (dto.vendorProfileId !== undefined) {
      safeVendorProfileId = dto.vendorProfileId
        ? ((await this.repo.findVendorProfileId(dto.vendorProfileId))?.id ?? null)
        : null
    }
    let safeContactId: string | null | undefined
    if (dto.userVendorContactId !== undefined) {
      safeContactId = dto.userVendorContactId
        ? ((await this.repo.findUserContactId(dto.userVendorContactId, user.id))?.id ?? null)
        : null
    }
    const vendorProfileUpdate =
      safeVendorProfileId !== undefined
        ? {
            vendorProfileId: safeVendorProfileId,
            ...(safeVendorProfileId !== null ? { userVendorContactId: null } : {}),
          }
        : {}
    const contactUpdate =
      safeContactId !== undefined
        ? {
            userVendorContactId: safeContactId,
            ...(safeContactId !== null ? { vendorProfileId: null } : {}),
          }
        : {}

    const updated = await this.repo.updateItem(itemId, {
      ...(dto.label !== undefined && { label: requiredLabel(dto.label) }),
      ...(dto.vendorName !== undefined && { vendorName: dto.vendorName }),
      ...vendorProfileUpdate,
      ...contactUpdate,
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.allocatedAmount !== undefined && { allocatedAmount: dto.allocatedAmount }),
      ...(dto.spentAmount !== undefined && { spentAmount: dto.spentAmount }),
    })
    this.track(
      eventId,
      user.id,
      EventActivityAction.UPDATED,
      `Updated budget item “${updated.label || updated.vendorName || updated.category}”`,
      updated.id,
    )
    return updated
  }

  async deleteBudgetItem(clerkId: string, eventId: string, itemId: string) {
    const { user } = await this.access.require(clerkId, eventId, {
      surface: EventSurface.BUDGET,
      action: 'edit',
    })
    const existing = await this.repo.findItemSummary(eventId, itemId)
    if (!existing) throw new NotFoundException('Budget item not found')
    const deleted = await this.repo.deleteItem(itemId)
    this.track(
      eventId,
      user.id,
      EventActivityAction.DELETED,
      `Removed budget item “${existing.label || existing.vendorName || existing.category}”`,
      itemId,
    )
    return deleted
  }

  async addReceipt(
    clerkId: string,
    eventId: string,
    itemId: string,
    filename: string,
    url: string,
    mimeType?: string,
    fileSize?: number,
  ) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })
    const item = await this.repo.findItem(eventId, itemId)
    if (!item) throw new NotFoundException('Budget item not found')
    const created = await this.repo.createReceipt({
      budgetItemId: itemId,
      filename,
      url: `private/${basename(url)}`,
      mimeType: mimeType ?? null,
      fileSize: fileSize ?? null,
    })
    return { ...created, url: receiptProxyUrl(eventId, itemId, created.id) }
  }

  async openReceiptFile(clerkId: string, eventId: string, itemId: string, receiptId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'view' })
    const receipt = await this.repo.findReceiptForFile(eventId, itemId, receiptId)
    if (!receipt) throw new NotFoundException('Receipt not found')
    const name = basename(receipt.url.split('?')[0] ?? '')
    let kind: 'receipts' | 'images' | null = null
    if (receipt.url.includes('private/') || receipt.url.startsWith('private/')) kind = 'receipts'
    else if (name.startsWith('receipt-')) kind = 'images'
    const stream = kind ? await this.storage.download(kind, name) : null
    if (!stream) throw new NotFoundException('Receipt not found')
    return {
      stream,
      mimeType: receipt.mimeType ?? 'application/octet-stream',
      filename: receipt.filename,
    }
  }

  async deleteReceipt(clerkId: string, eventId: string, receiptId: string) {
    await this.access.require(clerkId, eventId, { surface: EventSurface.BUDGET, action: 'edit' })
    const receipt = await this.repo.findReceipt(receiptId)
    if (!receipt || receipt.budgetItem.eventId !== eventId) {
      throw new NotFoundException('Receipt not found')
    }
    const deleted = await this.repo.deleteReceipt(receiptId)
    const name = basename(receipt.url.split('?')[0] ?? '')
    if (receipt.url.includes('private/') || receipt.url.startsWith('private/')) {
      await this.storage.delete('receipts', name)
    } else if (name.startsWith('receipt-')) {
      await this.storage.delete('images', name)
    }
    return deleted
  }

  private track(
    eventId: string,
    actorId: string,
    action: EventActivityAction,
    summary: string,
    subjectId?: string,
  ) {
    void this.activity.log({
      eventId,
      actorId,
      action,
      surface: EventSurface.BUDGET,
      summary,
      subjectType: subjectId ? 'BUDGET_ITEM' : undefined,
      subjectId,
    })
  }
}
