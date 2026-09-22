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

  it('exposes import jobs when the user pastes a list', () => {
    expect(selectToolNames('paste this guest list', 'user')).toEqual(
      expect.arrayContaining(['import_guests']),
    )
    expect(selectToolNames('import these budget lines', 'user')).toEqual(
      expect.arrayContaining(['import_budget']),
    )
    expect(selectToolNames('paste this checklist', 'user')).toEqual(
      expect.arrayContaining(['import_checklist']),
    )
    expect(selectToolNames('paste this schedule', 'user')).toEqual(
      expect.arrayContaining(['import_schedule']),
    )
    expect(selectToolNames('import the bridal party', 'user')).toEqual(
      expect.arrayContaining(['import_party']),
    )
    expect(selectToolNames('I attached a spreadsheet', 'user', 'guests')).toEqual(
      expect.arrayContaining(['import_guests']),
    )
    expect(selectToolNames('I attached a spreadsheet', 'user', 'budget')).toEqual(
      expect.arrayContaining(['import_budget']),
    )
  })

  it('exposes weekend, site copy, and leftover reads', () => {
    expect(selectToolNames('build the yoruba weekend', 'user')).toEqual(
      expect.arrayContaining(['apply_weekend', 'lookup_culture']),
    )
    expect(selectToolNames('draft the dress code and travel copy', 'user')).toEqual(
      expect.arrayContaining(['draft_site_copy']),
    )
    expect(selectToolNames("what's left this week", 'user')).toEqual(
      expect.arrayContaining(['list_checklist', 'get_event']),
    )
    expect(selectToolNames('who still needs an invite', 'user')).toEqual(
      expect.arrayContaining(['list_guests', 'bulk_invite_guests']),
    )
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
