import { EventPartySide, VendorCategory } from '@prisma/client'
import {
  IMPORT_ROW_CAP,
  budgetLabel,
  parseImportBudget,
  parseImportChecklist,
  parseImportGuests,
  parseImportParty,
  parseImportSchedule,
  importPreview,
  partyLabel,
  scheduleLabel,
} from './assistant.import'

describe('assistant.import', () => {
  it('maps snake_case guest rows and drops nameless lines', () => {
    const parsed = parseImportGuests([
      { first_name: 'Bola', last_name: 'Ade', plus_one_allowed: true },
      { firstName: 'Tunde', email: 'tunde@example.com' },
      { last_name: 'NoFirst' },
    ])
    expect(parsed.dropped).toBe(1)
    expect(parsed.rows).toEqual([
      expect.objectContaining({ firstName: 'Bola', lastName: 'Ade', plusOneAllowed: true }),
      expect.objectContaining({ firstName: 'Tunde', email: 'tunde@example.com' }),
    ])
  })

  it('keeps known budget categories and skips invented ones', () => {
    const parsed = parseImportBudget([
      { category: 'caterer', label: 'Food', allocated_amount: 1200000 },
      { category: 'typical hall', label: 'Venue', allocated_amount: 500 },
      { label: 'No category', allocated_amount: 10 },
    ])
    expect(parsed.dropped).toBe(2)
    expect(parsed.rows).toEqual([
      {
        category: VendorCategory.CATERER,
        label: 'Food',
        allocatedAmount: 1_200_000,
      },
    ])
  })

  it('reads checklist titles and only keeps ISO due dates', () => {
    const parsed = parseImportChecklist([
      { title: 'Book DJ', due_date: '2027-10-01' },
      { title: 'x' },
      { title: 'Buy aso-ebi', due_date: 'next Friday' },
    ])
    expect(parsed.dropped).toBe(1)
    expect(parsed.rows).toEqual([
      { title: 'Book DJ', dueDate: '2027-10-01' },
      { title: 'Buy aso-ebi' },
    ])
  })

  it('builds a confirm preview without inventing fields', () => {
    const parsed = parseImportGuests([{ first_name: 'Ada' }])
    const preview = importPreview(
      'guests',
      parsed,
      parsed.rows.map((row) => row.firstName),
    )
    expect(preview.summary).toBe('Add 1 guest?')
    expect(preview.blast).toMatch(/Review every row/)
    expect(preview.blast).toMatch(/Nothing is emailed/)
    expect(IMPORT_ROW_CAP).toBe(100)
  })

  it('labels budget rows with amounts when present', () => {
    expect(
      budgetLabel({ category: VendorCategory.DJ, label: 'Reception DJ', allocatedAmount: 80 }),
    ).toBe('Reception DJ · 80')
  })

  it('keeps ISO schedule dates and HH:MM times, drops invented times', () => {
    const parsed = parseImportSchedule([
      { title: 'Introduction', date: '2027-10-08', start_time: '10:00', location: 'Ikeja' },
      { title: 'Reception', start_time: 'evening' },
      { title: 'x' },
    ])
    expect(parsed.dropped).toBe(1)
    expect(parsed.rows).toEqual([
      { title: 'Introduction', date: '2027-10-08', startTime: '10:00', location: 'Ikeja' },
      { title: 'Reception' },
    ])
    expect(scheduleLabel(parsed.rows[0])).toBe('Introduction · 2027-10-08 10:00')
  })

  it('reads party names and sides, never invents bios', () => {
    const parsed = parseImportParty([
      { name: 'Amaka', role: 'Maid of honour', side: 'bride' },
      { name: 'Tunde', side: 'GROOM' },
      { role: 'Best man' },
    ])
    expect(parsed.dropped).toBe(1)
    expect(parsed.rows).toEqual([
      { name: 'Amaka', role: 'Maid of honour', side: EventPartySide.BRIDE },
      { name: 'Tunde', side: EventPartySide.GROOM },
    ])
    expect(partyLabel(parsed.rows[0])).toBe('Amaka · Maid of honour · BRIDE')
    const preview = importPreview('party', parsed, [])
    expect(preview.blast).toMatch(/Bios and photos are not added/)
  })
})
