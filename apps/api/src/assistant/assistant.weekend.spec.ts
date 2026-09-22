import { EventType, VendorCategory } from '@prisma/client'
import { parseApplyWeekend, weekendHints, weekendPreview } from './assistant.weekend'

describe('assistant.weekend', () => {
  it('maps named ceremonies and keeps only ISO dates', () => {
    const parsed = parseApplyWeekend(
      [
        { event_type: 'introduction', date: '2027-10-08' },
        { title: 'Traditional', date: 'next Friday' },
        { ceremony: 'court' },
        { event_type: 'unknown-rite' },
      ],
      { includeBridePrice: false },
    )
    expect(parsed.dropped).toBe(1)
    expect(parsed.ceremonies).toEqual([
      { eventType: EventType.INTRODUCTION, title: 'Introduction', estimatedDate: '2027-10-08' },
      { eventType: EventType.TRADITIONAL_WEDDING, title: 'Traditional' },
      { eventType: EventType.COURT, title: 'Court wedding' },
    ])
  })

  it('omits bride price unless the host asked', () => {
    const skipped = parseApplyWeekend([
      { event_type: 'bride price' },
      { event_type: 'introduction' },
    ])
    expect(skipped.ceremonies.map((row) => row.eventType)).toEqual([EventType.INTRODUCTION])
    const kept = parseApplyWeekend(
      [{ event_type: 'bride price' }, { event_type: 'introduction' }],
      {
        includeBridePrice: true,
      },
    )
    expect(kept.ceremonies.map((row) => row.eventType)).toEqual([
      EventType.BRIDE_PRICE,
      EventType.INTRODUCTION,
    ])
  })

  it('collects pack hints at amount 0 and builds a named confirm card', () => {
    const parsed = parseApplyWeekend([{ event_type: 'introduction' }])
    const hints = weekendHints(['YORUBA'], parsed.ceremonies)
    expect(hints.checklist.length).toBeGreaterThan(0)
    expect(hints.budget.every((row) => row.allocatedAmount === 0)).toBe(true)
    expect(hints.budget.every((row) => row.category === VendorCategory.OTHER)).toBe(true)
    const preview = weekendPreview('Ima & Oct', parsed, hints)
    expect(preview.summary).toBe('Create 1 ceremony on Ima & Oct?')
    expect(preview.blast).toMatch(/Introduction/)
    expect(preview.blast).toMatch(/amount 0/)
    expect(preview.blast).toMatch(/Bride price is omitted/)
    expect(preview.blast).not.toMatch(/1\. Bride price/)
  })
})
