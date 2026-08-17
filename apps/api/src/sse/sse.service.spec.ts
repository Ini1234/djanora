import { SseService, SSE_MAX_CONNECTIONS_PER_USER } from './sse.service'

function businessEvents(received: Array<{ type: string }>) {
  return received.filter((event) => event.type !== 'heartbeat').map((event) => event.type)
}

describe('SseService', () => {
  let svc: SseService

  beforeEach(() => {
    svc = new SseService()
  })

  afterEach(() => {
    svc.onModuleDestroy()
  })

  it('fans out an emit to every live subscriber for the same user', () => {
    const a: { type: string }[] = []
    const b: { type: string }[] = []
    const subA = svc.subscribe('u1').subscribe((event) => a.push(event))
    const subB = svc.subscribe('u1').subscribe((event) => b.push(event))

    svc.emit('u1', { type: 'inquiry_status', inquiryId: 'i1', status: 'QUOTED' })

    expect(businessEvents(a)).toEqual(['inquiry_status'])
    expect(businessEvents(b)).toEqual(['inquiry_status'])

    subA.unsubscribe()
    subB.unsubscribe()
  })

  it('does not complete sibling connections when one unsubscribes', () => {
    const a: { type: string }[] = []
    const b: { type: string }[] = []
    const subA = svc.subscribe('u1').subscribe((event) => a.push(event))
    const subB = svc.subscribe('u1').subscribe((event) => b.push(event))

    subA.unsubscribe()
    svc.emit('u1', { type: 'inquiry_status', inquiryId: 'i1', status: 'BOOKED' })

    expect(businessEvents(a)).toEqual([])
    expect(businessEvents(b)).toEqual(['inquiry_status'])

    subB.unsubscribe()
  })

  it('does not deliver to a different user', () => {
    const other: { type: string }[] = []
    const sub = svc.subscribe('u2').subscribe((event) => other.push(event))

    svc.emit('u1', { type: 'inquiry_status', inquiryId: 'i1', status: 'QUOTED' })

    expect(businessEvents(other)).toEqual([])
    sub.unsubscribe()
  })

  it('evicts the oldest connection when the per-user cap is exceeded', () => {
    const buckets: { type: string }[][] = Array.from(
      { length: SSE_MAX_CONNECTIONS_PER_USER + 1 },
      () => [],
    )
    const subs = buckets.map((bucket) =>
      svc.subscribe('u1').subscribe((event) => bucket.push(event)),
    )

    svc.emit('u1', { type: 'inquiry_status', inquiryId: 'i1', status: 'QUOTED' })

    expect(businessEvents(buckets[0])).toEqual([])
    for (let i = 1; i < buckets.length; i++) {
      expect(businessEvents(buckets[i])).toEqual(['inquiry_status'])
    }

    subs.forEach((sub) => sub.unsubscribe())
  })
})
