import {
  listedCities,
  listedTribes,
  lookupCity,
  lookupCulture,
  resolveTribe,
} from './assistant.packs'

describe('assistant.packs', () => {
  it('resolves tribe aliases and refuses unknowns', () => {
    expect(resolveTribe('Yoruba')).toBe('YORUBA')
    expect(resolveTribe('edo')).toBe('BINI')
    expect(resolveTribe('Martian')).toBeNull()
  })

  it('returns a ceremony-specific note when one exists', () => {
    const note = lookupCulture('igbo', 'bride price')
    expect(note?.ceremony).toBe('BRIDE_PRICE')
    expect(note?.summary).toMatch(/family negotiation/i)
    expect(note?.source).toMatch(/founder pack/i)
  })

  it('falls back to the tribe overview', () => {
    const note = lookupCulture('yoruba', 'court')
    expect(note?.tribe).toBe('YORUBA')
    expect(note?.ceremony).toBeUndefined()
  })

  it('refuses unknown tribe or city', () => {
    expect(lookupCulture('atlantis')).toBeNull()
    expect(lookupCity('Wakanda')).toBeNull()
  })

  it('matches packed cities without inventing others', () => {
    expect(lookupCity('Lagos')?.country).toBe('Nigeria')
    expect(lookupCity('toronto')?.city).toBe('Toronto')
    expect(listedTribes()).toEqual(expect.arrayContaining(['YORUBA', 'IGBO', 'OTHER']))
    expect(listedCities().some((c) => c.startsWith('Ottawa'))).toBe(true)
  })
})
