import { EventSiteSectionType } from '@prisma/client'
import { parseDraftSiteCopy, siteCopyPreview, siteSlugFromTitle } from './assistant.site-copy'

describe('assistant.site-copy', () => {
  it('keeps only the four text sections', () => {
    const sections = parseDraftSiteCopy({
      about: 'We met in Lagos.',
      travel: 'Use the Ikeja exit.',
      stay: 'The Marriott holds a block.',
      dress_code: 'Aso-oke, no white.',
      theme_preset: 'luxe',
      cover: 'https://example.com/cover.jpg',
    })
    expect(sections.map((row) => row.type)).toEqual([
      EventSiteSectionType.ABOUT,
      EventSiteSectionType.TRAVEL,
      EventSiteSectionType.STAY,
      EventSiteSectionType.DRESS_CODE,
    ])
    expect(sections.some((row) => row.body.includes('luxe'))).toBe(false)
  })

  it('refuses an empty draft and builds a not-published preview', () => {
    expect(parseDraftSiteCopy({ about: '   ' })).toEqual([])
    const preview = siteCopyPreview(parseDraftSiteCopy({ about: 'Welcome.' }))
    expect(preview.summary).toBe('Draft 1 site section?')
    expect(preview.blast).toMatch(/not published/)
    expect(preview.blast).toMatch(/Welcome/)
  })

  it('builds a usable slug from the event title', () => {
    expect(siteSlugFromTitle('Ima & Oct', 'evt1234567890')).toBe('ima-oct')
    expect(siteSlugFromTitle('??', 'ab-cd-ef')).toMatch(/^evt-/)
  })
})
