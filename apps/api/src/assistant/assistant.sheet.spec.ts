import { IMPORT_ROW_CAP } from './assistant.import'
import { formatSheetContext, sanitizeSheetContext } from './assistant.sheet'

describe('assistant.sheet', () => {
  it('keeps a messy grid without treating row 1 as headers', () => {
    const sheet = sanitizeSheetContext({
      kind: 'guests',
      filename: 'uploads/../RSVP list.xlsx',
      grid: [
        ['Ada', 'Okonkwo', 'ada@example.com'],
        ['Tunde Ade', '', ''],
        ['', '', ''],
      ],
    })
    expect(sheet?.filename).toBe('RSVP list.xlsx')
    expect(sheet?.grid).toEqual([
      ['Ada', 'Okonkwo', 'ada@example.com'],
      ['Tunde Ade', '', ''],
    ])
    const text = formatSheetContext(sheet)
    expect(text).toMatch(/R1: Ada/)
    expect(text).toMatch(/Do not assume row 1 is a header/)
    expect(text).toMatch(/Never invent/)
    expect(text).not.toMatch(/first_name/)
  })

  it('refuses unknown kinds and empty sheets', () => {
    expect(sanitizeSheetContext({ kind: 'photos', grid: [['a']] })).toBeUndefined()
    expect(sanitizeSheetContext({ kind: 'guests', grid: [['', '']] })).toBeUndefined()
  })

  it('caps rows and does not invent mappings', () => {
    const grid = Array.from({ length: IMPORT_ROW_CAP + 5 }, (_, i) => [`Person ${i}`])
    const sheet = sanitizeSheetContext({ kind: 'guests', filename: 'big.csv', grid })
    expect(sheet?.grid).toHaveLength(IMPORT_ROW_CAP)
    expect(sheet?.truncated).toBe(true)
    expect(formatSheetContext(sheet)).toMatch(/split the rest/)
  })
})
