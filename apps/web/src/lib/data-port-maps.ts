import {
  VENDOR_CATEGORY_KEYS,
  VENDOR_CATEGORY_LABELS_EN,
  type VendorCategoryKey,
} from '@/lib/vendor-categories'
import type { EventBudgetItem, Guest } from '@/lib/api.types'
import type { SheetCell, SheetTable } from '@/lib/sheet-io'

const FR_CATEGORY_LABELS: Record<VendorCategoryKey, string> = {
  CATERER: 'Traiteur / Alimentation',
  PHOTOGRAPHER: 'Photographe',
  VIDEOGRAPHER: 'Vidéaste',
  DECORATOR: 'Décorateur / Fleuriste',
  DJ: 'DJ',
  LIVE_BAND: 'Groupe live / Musicien',
  MAKEUP_ARTIST: 'Maquilleur·euse / Beauté',
  MC: 'Animateur / Maître de cérémonie',
  WEDDING_PLANNER: 'Wedding Planner',
  FASHION_STYLIST: 'Styliste / Tissu',
  OTHER: 'Autre prestation',
}

function norm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

const CATEGORY_LOOKUP = new Map<string, VendorCategoryKey>()
for (const key of VENDOR_CATEGORY_KEYS) {
  CATEGORY_LOOKUP.set(norm(key), key)
  CATEGORY_LOOKUP.set(norm(VENDOR_CATEGORY_LABELS_EN[key]), key)
  CATEGORY_LOOKUP.set(norm(FR_CATEGORY_LABELS[key]), key)
}

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

export type BudgetImportRow = {
  category: VendorCategoryKey
  label: string
  vendorName?: string
  notes?: string
  allocatedAmount: number
  spentAmount?: number
}

export type GuestImportRow = {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  note?: string
  plusOneAllowed?: boolean
  tableNumber?: string
}

function colIndex(headers: string[], aliases: string[]) {
  const wanted = aliases.map(norm)
  return headers.findIndex((header) => wanted.includes(norm(header)))
}

function cell(row: string[], index: number) {
  return index >= 0 ? (row[index] ?? '').trim() : ''
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned) return 0
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function parseBool(value: string) {
  const key = norm(value)
  if (['yes', 'true', '1', 'y', 'oui', 'o'].includes(key)) return true
  if (['no', 'false', '0', 'n', 'non'].includes(key)) return false
  return null
}

function resolveCategory(value: string): VendorCategoryKey | null {
  if (!value) return null
  return CATEGORY_LOOKUP.get(norm(value)) ?? null
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) ?? '' }
}

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

export function parseBudgetTable(table: SheetTable): {
  items: BudgetImportRow[]
  issues: string[]
} {
  const { headers, rows } = table
  const idx = {
    name: colIndex(headers, ['name', 'title', 'item', 'label']),
    category: colIndex(headers, ['category', 'type']),
    vendor: colIndex(headers, ['vendor', 'vendorname', 'supplier']),
    allocated: colIndex(headers, ['allocated', 'allocatedamount', 'budget', 'amount']),
    spent: colIndex(headers, ['spent', 'paid', 'actual']),
    notes: colIndex(headers, ['notes', 'note']),
  }
  const items: BudgetImportRow[] = []
  const issues: string[] = []
  rows.forEach((row, i) => {
    const line = i + 2
    const categoryRaw = cell(row, idx.category) || cell(row, idx.name)
    const category = resolveCategory(categoryRaw) ?? (cell(row, idx.category) ? null : 'OTHER')
    if (!category) {
      issues.push(`Row ${line}: unknown category “${categoryRaw}”.`)
      return
    }
    const allocated = parseMoney(cell(row, idx.allocated))
    if (allocated === null) {
      issues.push(`Row ${line}: allocated amount is invalid.`)
      return
    }
    const spentRaw = cell(row, idx.spent)
    const spent = spentRaw ? parseMoney(spentRaw) : 0
    if (spent === null) {
      issues.push(`Row ${line}: spent amount is invalid.`)
      return
    }
    const label = cell(row, idx.name)
    if (!label) {
      issues.push(`Row ${line}: name is required.`)
      return
    }
    items.push({
      category,
      label,
      ...(cell(row, idx.vendor) && { vendorName: cell(row, idx.vendor) }),
      ...(cell(row, idx.notes) && { notes: cell(row, idx.notes) }),
      allocatedAmount: allocated,
      spentAmount: spent,
    })
  })
  return { items, issues }
}

export const IMPORT_ROW_CAP = 500

export function capImportRows<T>(items: T[], issues: string[], tooManyMessage: string) {
  if (items.length <= IMPORT_ROW_CAP) return { items, issues }
  return { items: items.slice(0, IMPORT_ROW_CAP), issues: [...issues, tooManyMessage] }
}

export function parseGuestTable(table: SheetTable): {
  items: GuestImportRow[]
  issues: string[]
} {
  const { headers, rows } = table
  const idx = {
    name: colIndex(headers, ['name', 'full name', 'guest']),
    first: colIndex(headers, ['firstname', 'first', 'prenom']),
    last: colIndex(headers, ['lastname', 'last', 'nom']),
    email: colIndex(headers, ['email', 'e-mail']),
    phone: colIndex(headers, ['phone', 'mobile', 'tel', 'telephone']),
    table: colIndex(headers, ['table', 'tablenumber', 'seat']),
    plus: colIndex(headers, ['plusone', 'plus 1', 'plusoneallowed', 'guestplusone']),
    notes: colIndex(headers, ['notes', 'note']),
  }
  const items: GuestImportRow[] = []
  const issues: string[] = []
  rows.forEach((row, i) => {
    const line = i + 2
    let firstName = cell(row, idx.first)
    let lastName = cell(row, idx.last)
    if (!firstName && cell(row, idx.name)) {
      const split = splitName(cell(row, idx.name))
      firstName = split.firstName
      lastName = lastName || split.lastName
    }
    if (!firstName) {
      issues.push(`Row ${line}: first name is required.`)
      return
    }
    const email = cell(row, idx.email)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push(`Row ${line}: email “${email}” looks invalid — skipped.`)
      return
    }
    const plus = parseBool(cell(row, idx.plus))
    items.push({
      firstName,
      ...(lastName && { lastName }),
      ...(email && { email }),
      ...(cell(row, idx.phone) && { phone: cell(row, idx.phone) }),
      ...(cell(row, idx.notes) && { note: cell(row, idx.notes) }),
      ...(plus !== null && { plusOneAllowed: plus }),
      ...(cell(row, idx.table) && { tableNumber: cell(row, idx.table) }),
    })
  })
  return { items, issues }
}
