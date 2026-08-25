import { BadRequestException } from '@nestjs/common'
import { InspirationCategory } from '@prisma/client'
import { normalizePostCategories } from './post-shape'

describe('normalizePostCategories', () => {
  it('uses the categories array when present', () => {
    expect(
      normalizePostCategories(InspirationCategory.OTHER, [
        InspirationCategory.FASHION,
        InspirationCategory.DECOR,
        InspirationCategory.FASHION,
      ]),
    ).toEqual({
      category: InspirationCategory.FASHION,
      categories: [InspirationCategory.FASHION, InspirationCategory.DECOR],
    })
  })

  it('falls back to a single category', () => {
    expect(normalizePostCategories(InspirationCategory.FOOD)).toEqual({
      category: InspirationCategory.FOOD,
      categories: [InspirationCategory.FOOD],
    })
  })

  it('rejects an empty selection', () => {
    expect(() => normalizePostCategories()).toThrow(BadRequestException)
  })
})
