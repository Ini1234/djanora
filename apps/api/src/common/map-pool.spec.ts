import { mapPool } from './map-pool'

describe('mapPool', () => {
  it('preserves order with bounded concurrency', async () => {
    let inFlight = 0
    let peak = 0
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return n * 10
    })
    expect(out).toEqual([10, 20, 30, 40, 50])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('returns empty for empty input', async () => {
    expect(await mapPool([], 4, (n: number) => Promise.resolve(n))).toEqual([])
  })
})
