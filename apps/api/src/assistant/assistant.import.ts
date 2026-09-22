import { EventPartySide, VendorCategory } from '@prisma/client'
import type { CreateGuestDto } from '../guests/dto/guests.dto'

export const IMPORT_ROW_CAP = 100

export type ImportKind = 'guests' | 'budget' | 'checklist' | 'schedule' | 'party'

export type ParsedImport<T> = {
  rows: T[]
  dropped: number
}

export type ImportBudgetRow = {
  category: VendorCategory
  label: string
  allocatedAmount: number
  vendorName?: string
}

export type ImportChecklistRow = {
  title: string
  description?: string
  dueDate?: string
}

export type ImportScheduleRow = {
  title: string
  date?: string
  startTime?: string
  endTime?: string
  location?: string
}

export type ImportPartyRow = {
  name: string
  role?: string
  side: EventPartySide
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = text(row[key])
    if (found) return found
  }
  return undefined
}

function money(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[,_\s]/g, '').replace(/^[₦$£]/, '')
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function vendorCategory(value: unknown): VendorCategory | undefined {
  if (typeof value !== 'string') return undefined
  const key = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (key in VendorCategory) return key as VendorCategory
  return undefined
}

export function isoDate(value: unknown): string | undefined {
  const raw = text(value)
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined
}

export function hhmm(value: unknown): string | undefined {
  const raw = text(value)
  if (!raw) return undefined
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw)
  return match ? `${match[1]}:${match[2]}` : undefined
}

function partySide(value: unknown): EventPartySide {
  const raw = text(value)
    ?.toUpperCase()
    .replace(/[\s-]+/g, '_')
  if (raw === 'BRIDE' || raw === 'BRIDE_SIDE') return EventPartySide.BRIDE
  if (raw === 'GROOM' || raw === 'GROOM_SIDE') return EventPartySide.GROOM
  return EventPartySide.OTHER
}

export function parseImportGuests(raw: unknown): ParsedImport<CreateGuestDto> {
  const list = Array.isArray(raw) ? raw : []
  const rows: CreateGuestDto[] = []
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const firstName = pick(row, 'first_name', 'firstName')
    if (!firstName) {
      dropped += 1
      continue
    }
    rows.push({
      firstName,
      lastName: pick(row, 'last_name', 'lastName'),
      email: pick(row, 'email'),
      phone: pick(row, 'phone'),
      note: pick(row, 'note'),
      plusOneAllowed: row.plus_one_allowed === true || row.plusOneAllowed === true,
      tableNumber: pick(row, 'table_number', 'tableNumber'),
    })
  }
  return { rows, dropped }
}

export function parseImportBudget(raw: unknown): ParsedImport<ImportBudgetRow> {
  const list = Array.isArray(raw) ? raw : []
  const rows: ImportBudgetRow[] = []
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const label = pick(row, 'label', 'name')
    const category = vendorCategory(row.category)
    if (!label || !category) {
      dropped += 1
      continue
    }
    const allocated = money(row.allocated_amount ?? row.allocatedAmount) ?? 0
    const vendorName = pick(row, 'vendor_name', 'vendorName')
    rows.push({
      category,
      label,
      allocatedAmount: allocated,
      ...(vendorName ? { vendorName } : {}),
    })
  }
  return { rows, dropped }
}

export function parseImportChecklist(raw: unknown): ParsedImport<ImportChecklistRow> {
  const list = Array.isArray(raw) ? raw : []
  const rows: ImportChecklistRow[] = []
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const title = pick(row, 'title', 'name')
    if (!title || title.length < 2) {
      dropped += 1
      continue
    }
    const description = pick(row, 'description', 'notes')
    const dueDate = isoDate(row.due_date ?? row.dueDate)
    rows.push({
      title,
      ...(description ? { description } : {}),
      ...(dueDate ? { dueDate } : {}),
    })
  }
  return { rows, dropped }
}

export function parseImportSchedule(raw: unknown): ParsedImport<ImportScheduleRow> {
  const list = Array.isArray(raw) ? raw : []
  const rows: ImportScheduleRow[] = []
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const title = pick(row, 'title', 'name')
    if (!title || title.length < 2) {
      dropped += 1
      continue
    }
    const date = isoDate(row.date)
    const startTime = hhmm(row.start_time ?? row.startTime)
    const endTime = hhmm(row.end_time ?? row.endTime)
    const location = pick(row, 'location')
    rows.push({
      title,
      ...(date ? { date } : {}),
      ...(startTime ? { startTime } : {}),
      ...(endTime ? { endTime } : {}),
      ...(location ? { location } : {}),
    })
  }
  return { rows, dropped }
}

export function parseImportParty(raw: unknown): ParsedImport<ImportPartyRow> {
  const list = Array.isArray(raw) ? raw : []
  const rows: ImportPartyRow[] = []
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const name = pick(row, 'name')
    if (!name) {
      dropped += 1
      continue
    }
    const role = pick(row, 'role')
    rows.push({
      name,
      ...(role ? { role } : {}),
      side: partySide(row.side),
    })
  }
  return { rows, dropped }
}

const NOUN: Record<ImportKind, [string, string]> = {
  guests: ['guest', 'guests'],
  budget: ['budget line', 'budget lines'],
  checklist: ['checklist item', 'checklist items'],
  schedule: ['schedule block', 'schedule blocks'],
  party: ['party member', 'party members'],
}

export function importPreview(kind: ImportKind, parsed: ParsedImport<unknown>, _labels: string[]) {
  const n = parsed.rows.length
  const [one, many] = NOUN[kind]
  const summary = `Add ${n} ${n === 1 ? one : many}?`
  const parts = ['Review every row below before adding.']
  if (parsed.dropped) {
    parts.push(
      `${parsed.dropped} line${parsed.dropped === 1 ? '' : 's'} could not be read and will be skipped.`,
    )
  }
  if (kind === 'guests') {
    parts.push('Nothing is emailed or texted. Duplicates already on the event are skipped.')
  } else if (kind === 'party') {
    parts.push(
      'Bios and photos are not added. Names already on the roster are skipped. They stay off the public site.',
    )
  } else if (kind === 'schedule') {
    parts.push(
      'Times stay as written. Dates that are not YYYY-MM-DD are dropped. Blocks stay off the public site.',
    )
  } else {
    parts.push('Nothing is emailed or texted. Duplicates already on the event are skipped.')
  }
  return { summary, blast: parts.join('\n\n') }
}

export function guestLabel(row: CreateGuestDto) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ')
}

export function budgetLabel(row: ImportBudgetRow) {
  const amount = row.allocatedAmount ? ` · ${row.allocatedAmount}` : ''
  return `${row.label}${amount}`
}

export function checklistLabel(row: ImportChecklistRow) {
  return row.title
}

export function scheduleLabel(row: ImportScheduleRow) {
  const when = [row.date, row.startTime, row.endTime ? `– ${row.endTime}` : '']
    .filter(Boolean)
    .join(' ')
  return when ? `${row.title} · ${when}` : row.title
}

export function partyLabel(row: ImportPartyRow) {
  const extra = [row.role, row.side !== EventPartySide.OTHER ? row.side : '']
    .filter(Boolean)
    .join(' · ')
  return extra ? `${row.name} · ${extra}` : row.name
}
