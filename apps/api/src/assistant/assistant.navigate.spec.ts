import { buildNavHref, isSafeAppHref, sanitizePageContext } from './assistant.navigate'

describe('assistant.navigate', () => {
  it('builds event tab and guests hrefs', () => {
    expect(buildNavHref({ screen: 'event', eventId: 'evt_1', tab: 'budget' })).toEqual({
      ok: true,
      href: '/events/evt_1?tab=budget',
      label: 'Event (budget)',
    })
    expect(buildNavHref({ screen: 'event_guests', eventId: 'evt_1' })).toEqual({
      ok: true,
      href: '/events/evt_1/guests',
      label: 'Guests',
    })
  })

  it('refuses unknown tabs and off-app hrefs', () => {
    expect(buildNavHref({ screen: 'event', eventId: 'evt_1', tab: 'admin' }).ok).toBe(false)
    expect(isSafeAppHref('https://evil.example')).toBe(false)
    expect(isSafeAppHref('//evil.example')).toBe(false)
    expect(isSafeAppHref('/e/public-slug')).toBe(false)
    expect(isSafeAppHref('/events/evt_1?tab=budget')).toBe(true)
  })

  it('drops injected page-context fields', () => {
    const ctx = sanitizePageContext({
      pathname: '/events/abc',
      search: '?tab=overview',
      eventId: 'abc',
      tab: 'overview',
      extra: 'ignore',
    })
    expect(ctx).toEqual({
      pathname: '/events/abc',
      search: '?tab=overview',
      eventId: 'abc',
      tab: 'overview',
    })
    expect(sanitizePageContext({ pathname: 'https://x' })).toEqual({})
  })
})
