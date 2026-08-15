import type { InAppNotification } from '@/lib/api.types'

const COMMENT_TAB: Record<string, string> = {
  SCHEDULE_ITEM: 'schedule',
  CHECKLIST_ITEM: 'checklist',
  BUDGET_ITEM: 'budget',
  MOOD_BOARD_ITEM: 'moodboard',
}

const VENDOR_INQUIRY_TYPES = new Set([
  'INQUIRY_RECEIVED',
  'INQUIRY_DECLINED',
  'INQUIRY_ACCEPTED',
  'BOOKING_CONFIRMED',
])

function safePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

function str(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function inquiryThreadHref(inquiryId: string, vendorMode: boolean): string {
  return vendorMode ? `/inquiries?inquiry=${inquiryId}` : `/messages?inquiry=${inquiryId}`
}

export function notificationHref(
  n: Pick<InAppNotification, 'type' | 'metadata'>,
  opts?: { vendorMode?: boolean },
): string | null {
  const meta = n.metadata ?? {}

  if (n.type === 'EVENT_INVITE') {
    const token = str(meta, 'token')
    return safePath(meta.href) ?? (token ? `/events/join/${token}` : null)
  }

  if (n.type === 'EVENT_COMMENT') {
    const eventId = str(meta, 'eventId')
    if (!eventId) return safePath(meta.href)
    const tab = COMMENT_TAB[str(meta, 'subjectType') ?? '']
    const item = str(meta, 'subjectId')
    const comment = str(meta, 'commentId')
    const commentQs = comment ? `&comment=${comment}` : ''
    if (tab && item) return `/events/${eventId}?tab=${tab}&item=${item}${commentQs}`
    if (comment) return `/events/${eventId}?tab=overview&comment=${comment}`
    return safePath(meta.href) ?? `/events/${eventId}`
  }

  if (n.type === 'INSPIRATION_COMMENT') {
    const itemId = str(meta, 'inspirationItemId')
    return safePath(meta.href) ?? (itemId ? `/inspiration?item=${itemId}` : '/inspiration')
  }

  if (n.type === 'EVENT_REMINDER') {
    const eventId = str(meta, 'eventId')
    if (!eventId) return safePath(meta.href)
    const item = str(meta, 'checklistItemId')
    return item
      ? `/events/${eventId}?tab=checklist&item=${item}`
      : `/events/${eventId}?tab=checklist`
  }

  const stored = safePath(meta.href)
  if (stored) return stored

  const inquiryId = str(meta, 'inquiryId')
  if (inquiryId) {
    const vendorMode = opts?.vendorMode === true || VENDOR_INQUIRY_TYPES.has(n.type)
    return inquiryThreadHref(inquiryId, vendorMode)
  }

  return null
}
