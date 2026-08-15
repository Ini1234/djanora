import type { EventJourneyStop, EventScheduleItem } from '@/lib/api.types'
import { eventDateKey, formatEventDate } from '@/lib/event-timing'

export type ItineraryKind = 'event' | 'block'

export type ItineraryRow =
  | { kind: 'event'; id: string; child: EventJourneyStop }
  | { kind: 'block'; id: string; item: EventScheduleItem }

export type ItineraryDay = {
  date: string | null
  label: string
  rows: ItineraryRow[]
}

function childDate(child: EventJourneyStop) {
  return eventDateKey(child.estimatedDate)
}

function compareChildren(a: EventJourneyStop, b: EventJourneyStop) {
  const aKey = childDate(a)
  const bKey = childDate(b)
  if (aKey && bKey && aKey !== bKey) return aKey < bKey ? -1 : 1
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.title.localeCompare(b.title)
}

function compareBlocks(a: EventScheduleItem, b: EventScheduleItem) {
  if (a.startTime && b.startTime && a.startTime !== b.startTime) {
    return a.startTime.localeCompare(b.startTime)
  }
  if (a.startTime && !b.startTime) return -1
  if (!a.startTime && b.startTime) return 1
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.title.localeCompare(b.title)
}

export function composeItinerary(
  children: EventJourneyStop[],
  blocks: EventScheduleItem[],
): ItineraryDay[] {
  const dates = new Set<string>()
  for (const child of children) {
    const key = childDate(child)
    if (key) dates.add(key)
  }
  for (const block of blocks) {
    const key = eventDateKey(block.date)
    if (key) dates.add(key)
  }

  const days: ItineraryDay[] = [...dates].sort().map((date) => {
    const eventRows: ItineraryRow[] = children
      .filter((child) => childDate(child) === date)
      .sort(compareChildren)
      .map((child) => ({ kind: 'event', id: child.id, child }))
    const timed = blocks
      .filter((block) => eventDateKey(block.date) === date && block.startTime)
      .sort(compareBlocks)
      .map((item) => ({ kind: 'block' as const, id: item.id, item }))
    const untimed = blocks
      .filter((block) => eventDateKey(block.date) === date && !block.startTime)
      .sort(compareBlocks)
      .map((item) => ({ kind: 'block' as const, id: item.id, item }))
    return {
      date,
      label: formatEventDate(date) ?? date,
      rows: [...eventRows, ...timed, ...untimed],
    }
  })

  const undatedChildren = children.filter((child) => !childDate(child)).sort(compareChildren)
  const undatedBlocks = blocks.filter((block) => !eventDateKey(block.date)).sort(compareBlocks)
  if (undatedChildren.length > 0 || undatedBlocks.length > 0) {
    days.push({
      date: null,
      label: 'Undated',
      rows: [
        ...undatedChildren.map((child) => ({ kind: 'event' as const, id: child.id, child })),
        ...undatedBlocks.map((item) => ({ kind: 'block' as const, id: item.id, item })),
      ],
    })
  }

  return days
}
