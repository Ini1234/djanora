import { EventType, VendorCategory } from '@prisma/client'
import { lookupCulture, resolveCeremony } from './assistant.packs'
import { isoDate, type ImportBudgetRow, type ImportChecklistRow } from './assistant.import'

export type WeekendCeremony = {
  eventType: EventType
  title: string
  estimatedDate?: string
}

export type ParsedWeekend = {
  ceremonies: WeekendCeremony[]
  includeBridePrice: boolean
  dropped: number
}

export type WeekendHints = {
  checklist: ImportChecklistRow[]
  budget: ImportBudgetRow[]
}

const TITLES: Record<EventType, string> = {
  WEDDING: 'Wedding',
  INTRODUCTION: 'Introduction',
  BRIDE_PRICE: 'Bride price',
  TRADITIONAL_WEDDING: 'Traditional wedding',
  COURT: 'Court wedding',
  WHITE_WEDDING: 'White wedding',
  RECEPTION: 'Reception',
  ENGAGEMENT: 'Engagement',
  NAMING_CEREMONY: 'Naming ceremony',
  CUSTOM: 'Ceremony',
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asEventType(value: string | undefined): EventType | undefined {
  if (!value) return undefined
  return (Object.values(EventType) as string[]).includes(value) ? (value as EventType) : undefined
}

export function defaultCeremonyTitle(type: EventType) {
  return TITLES[type]
}

export function parseApplyWeekend(
  raw: unknown,
  opts?: { includeBridePrice?: boolean },
): ParsedWeekend {
  const includeBridePrice = opts?.includeBridePrice === true
  const list = Array.isArray(raw) ? raw : []
  const ceremonies: WeekendCeremony[] = []
  const seen = new Set<EventType>()
  let dropped = 0
  for (const item of list) {
    const row = rec(item)
    const type = asEventType(
      resolveCeremony(
        text(row.event_type) ??
          text(row.eventType) ??
          text(row.type) ??
          text(row.ceremony) ??
          text(row.title),
      ),
    )
    if (!type) {
      dropped += 1
      continue
    }
    if (type === EventType.BRIDE_PRICE && !includeBridePrice) {
      dropped += 1
      continue
    }
    if (seen.has(type)) {
      dropped += 1
      continue
    }
    seen.add(type)
    const title = text(row.title) || defaultCeremonyTitle(type)
    const estimatedDate = isoDate(row.date ?? row.estimated_date ?? row.estimatedDate)
    ceremonies.push({
      eventType: type,
      title,
      ...(estimatedDate ? { estimatedDate } : {}),
    })
  }
  return { ceremonies, includeBridePrice, dropped }
}

export function weekendHints(tribes: string[], ceremonies: WeekendCeremony[]): WeekendHints {
  const checklistSeen = new Set<string>()
  const budgetSeen = new Set<string>()
  const checklist: ImportChecklistRow[] = []
  const budget: ImportBudgetRow[] = []
  for (const tribe of tribes) {
    for (const ceremony of ceremonies) {
      const note = lookupCulture(tribe, ceremony.eventType)
      if (!note) continue
      for (const title of note.checklistHints ?? []) {
        const key = title.trim().toLowerCase()
        if (!key || checklistSeen.has(key)) continue
        checklistSeen.add(key)
        checklist.push({ title })
      }
      for (const label of note.budgetHints ?? []) {
        const key = label.trim().toLowerCase()
        if (!key || budgetSeen.has(key)) continue
        budgetSeen.add(key)
        budget.push({ category: VendorCategory.OTHER, label, allocatedAmount: 0 })
      }
    }
  }
  return { checklist, budget }
}

export function weekendPreview(
  parentTitle: string,
  parsed: ParsedWeekend,
  hints: WeekendHints,
): { summary: string; blast: string } {
  const n = parsed.ceremonies.length
  const summary = `Create ${n} ceremon${n === 1 ? 'y' : 'ies'} on ${parentTitle}?`
  const lines = parsed.ceremonies.map((row, i) => {
    const date = row.estimatedDate ? ` — ${row.estimatedDate}` : ''
    return `${i + 1}. ${row.title}${date}`
  })
  const parts = [
    'These child events copy the parent tribe, look, city, and expected guest count. Dates stay blank unless you gave YYYY-MM-DD. Bride price is omitted unless you asked.',
    lines.join('\n'),
  ]
  if (hints.checklist.length) {
    parts.push(
      `Then add these parent checklist hints (duplicates skipped):\n${hints.checklist
        .map((row) => `- ${row.title}`)
        .join('\n')}`,
    )
  }
  if (hints.budget.length) {
    parts.push(
      `Budget lines at amount 0 (labels only; no invented prices):\n${hints.budget
        .map((row) => `- ${row.label}`)
        .join('\n')}`,
    )
  }
  if (parsed.dropped) {
    parts.push(
      `${parsed.dropped} named gathering${parsed.dropped === 1 ? '' : 's'} could not be used (unknown, duplicate, or bride price without asking).`,
    )
  }
  return { summary, blast: parts.join('\n\n') }
}
