import type { EventBudgetItem, Guest } from '@/lib/api.types'
import type { SheetCell } from '@/lib/sheet-io'

export const BUDGET_HEADERS = [
  'Name',
  'Category',
  'Vendor',
  'Allocated',
  'Spent',
  'Remaining',
  'Notes',
  'Currency',
] as const

export const GUEST_HEADERS = [
  'Name',
  'First name',
  'Last name',
  'Email',
  'Phone',
  'Table',
  'Plus one',
  'Notes',
  'RSVP',
  'Plus one name',
  'Dietary',
] as const

export function budgetExportRows(
  items: EventBudgetItem[],
  categoryLabel: (key: string) => string,
): SheetCell[][] {
  return items.map((item) => {
    const name = item.label || categoryLabel(item.category)
    return [
      name,
      categoryLabel(item.category),
      item.vendorName ?? '',
      item.allocatedAmount,
      item.spentAmount,
      item.allocatedAmount - item.spentAmount,
      item.notes ?? '',
      item.currency || 'CAD',
    ]
  })
}

export function guestExportRows(guests: Guest[]): SheetCell[][] {
  return guests.map((guest) => {
    const name = [guest.firstName, guest.lastName].filter(Boolean).join(' ')
    return [
      name,
      guest.firstName,
      guest.lastName ?? '',
      guest.email ?? '',
      guest.phone ?? '',
      guest.tableNumber ?? '',
      guest.plusOneAllowed ? 'Yes' : 'No',
      guest.note ?? '',
      guest.invite?.rsvpStatus ?? '',
      guest.invite?.plusOneName ?? '',
      guest.invite?.dietaryNote ?? '',
    ]
  })
}
