import { ASSISTANT_TOOLS, selectToolNames } from './assistant.catalog'

describe('assistant.catalog', () => {
  it('always includes identity, event pick, and culture lookups', () => {
    const names = selectToolNames('hello', 'user')
    expect(names).toEqual(
      expect.arrayContaining([
        'who_am_i',
        'set_current_event',
        'list_events',
        'get_event',
        'propose_navigation',
        'lookup_culture',
        'lookup_city',
      ]),
    )
  })

  it('adds guest tools when the user talks about RSVPs', () => {
    const names = selectToolNames('add a guest and send the rsvp invite', 'user')
    expect(names).toEqual(expect.arrayContaining(['add_guest', 'invite_guest']))
    expect(names).not.toContain('set_party_photo')
  })

  it('prefers vendor inbox tools in vendor mode', () => {
    const names = selectToolNames('what is new', 'vendor')
    expect(names).toEqual(expect.arrayContaining(['list_vendor_inquiries']))
  })

  it('caps the tool list', () => {
    expect(
      selectToolNames('event checklist budget guests vendors site', 'user').length,
    ).toBeLessThanOrEqual(14)
  })

  it('always includes navigation', () => {
    expect(selectToolNames('hello', 'user')).toContain('propose_navigation')
  })

  it('does not expose file upload jobs', () => {
    expect(ASSISTANT_TOOLS.some((t) => t.family === 'files')).toBe(false)
    expect(ASSISTANT_TOOLS.some((t) => t.name.includes('photo'))).toBe(false)
  })
})
