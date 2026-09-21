export type ToolFamily =
  | 'identity'
  | 'events'
  | 'checklist'
  | 'schedule'
  | 'party'
  | 'guests'
  | 'budget'
  | 'comments'
  | 'activity'
  | 'personal'
  | 'site'
  | 'members'
  | 'vendors'
  | 'inquiries'
  | 'inspiration'
  | 'notifications'
  | 'contacts'
  | 'files'
  | 'culture'
  | 'navigate'

export type CatalogTool = {
  name: string
  description: string
  family: ToolFamily
  parameters: Record<string, unknown>
}

const eventScope = {
  event_id: { type: 'string', description: 'Event id. Optional if a current event is set.' },
  event_title: { type: 'string', description: 'Unique event title if id is unknown.' },
}

const confirm = {
  confirm_token: {
    type: 'string',
    description: 'Do not set this. The UI attaches it after the host confirms.',
  },
}

function obj(
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> {
  return { type: 'object', properties, additionalProperties: false, required }
}

export const ASSISTANT_TOOLS: CatalogTool[] = [
  {
    name: 'lookup_culture',
    description:
      'Founder-written note for a Nigerian tribe and optional ceremony. Refuses unknown tribes or rites.',
    family: 'culture',
    parameters: obj(
      {
        tribe: {
          type: 'string',
          description: 'Yoruba, Igbo, Hausa, Ibibio, Efik, Ijaw, Urhobo, Bini, Fulani, Tiv, Other',
        },
        ceremony: {
          type: 'string',
          description:
            'introduction, bride price, traditional, court, white, reception, engagement, naming',
        },
      },
      ['tribe'],
    ),
  },
  {
    name: 'lookup_city',
    description: 'Founder-written planning note for a city. Refuses cities not in the pack.',
    family: 'culture',
    parameters: obj({ city: { type: 'string' } }, ['city']),
  },
  {
    name: 'who_am_i',
    description: 'Signed-in user, active mode, and current event for this chat.',
    family: 'identity',
    parameters: obj({}),
  },
  {
    name: 'set_active_mode',
    description: 'Switch between host (user) and vendor mode.',
    family: 'identity',
    parameters: obj({ mode: { type: 'string', enum: ['host', 'user', 'vendor'] } }, ['mode']),
  },
  {
    name: 'update_me',
    description: 'Update the signed-in profile.',
    family: 'identity',
    parameters: obj({
      first_name: { type: 'string' },
      last_name: { type: 'string' },
      phone: { type: 'string' },
      city: { type: 'string' },
    }),
  },
  {
    name: 'list_events',
    description: 'Events this user can see (id, title, date, guestCount).',
    family: 'events',
    parameters: obj({ limit: { type: 'number' }, cursor: { type: 'string' } }),
  },
  {
    name: 'get_event',
    description:
      'Event record the user can access, including guestCount (Guests expected), date, and budget. Not the RSVP list — use list_guests for named guests.',
    family: 'events',
    parameters: obj(eventScope),
  },
  {
    name: 'propose_navigation',
    description:
      'Open an in-app screen. The UI performs the jump. Never invent URLs. Event screens need a current event or event_id.',
    family: 'navigate',
    parameters: obj(
      {
        screen: {
          type: 'string',
          enum: [
            'home',
            'events',
            'event',
            'event_guests',
            'event_site',
            'event_new',
            'vendors',
            'messages',
            'inspiration',
            'likes',
            'settings',
            'assistant',
            'vendor_home',
            'inquiries',
            'portfolio',
          ],
        },
        event_id: eventScope.event_id,
        event_title: eventScope.event_title,
        tab: {
          type: 'string',
          enum: ['overview', 'schedule', 'checklist', 'budget', 'vendors', 'moodboard', 'party'],
          description: 'Event page tab. Only for screen=event.',
        },
        item_id: { type: 'string', description: 'Optional row to focus on an event tab.' },
      },
      ['screen'],
    ),
  },
  {
    name: 'set_current_event',
    description: 'Sticky event for this chat thread.',
    family: 'events',
    parameters: obj(eventScope),
  },
  {
    name: 'clear_current_event',
    description: 'Unset the thread event.',
    family: 'events',
    parameters: obj({}),
  },
  {
    name: 'create_event',
    description: 'Create an event.',
    family: 'events',
    parameters: obj(
      {
        title: { type: 'string' },
        event_type: { type: 'string' },
        tribes: { type: 'array', items: { type: 'string' } },
        themes: { type: 'array', items: { type: 'string' } },
        total_budget: { type: 'number' },
        include_default_budget: { type: 'boolean' },
        include_default_checklist: { type: 'boolean' },
        estimated_date: { type: 'string' },
        guest_count: { type: 'number' },
        location: { type: 'string' },
      },
      ['title'],
    ),
  },
  {
    name: 'update_event',
    description: 'Update event fields.',
    family: 'events',
    parameters: obj({
      ...eventScope,
      title: { type: 'string' },
      estimated_date: { type: 'string' },
      location: { type: 'string' },
      notes: { type: 'string' },
      total_budget: { type: 'number' },
      guest_count: { type: 'number' },
      is_completed: { type: 'boolean' },
      party_enabled: { type: 'boolean' },
    }),
  },
  {
    name: 'delete_event',
    description: 'Soft-delete an event. Needs UI confirm.',
    family: 'events',
    parameters: obj({ ...eventScope, ...confirm }),
  },
  {
    name: 'add_child_event',
    description: 'Add a child ceremony under this event.',
    family: 'events',
    parameters: obj({ ...eventScope, title: { type: 'string' }, event_type: { type: 'string' } }, [
      'title',
    ]),
  },
  {
    name: 'list_checklist',
    description: 'Checklist rows the viewer may see.',
    family: 'checklist',
    parameters: obj(eventScope),
  },
  {
    name: 'add_checklist_item',
    description: 'Add a checklist item.',
    family: 'checklist',
    parameters: obj(
      {
        ...eventScope,
        title: { type: 'string' },
        description: { type: 'string' },
        due_date: { type: 'string' },
      },
      ['title'],
    ),
  },
  {
    name: 'update_checklist_item',
    description: 'Update a checklist item.',
    family: 'checklist',
    parameters: obj(
      {
        ...eventScope,
        item_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        is_completed: { type: 'boolean' },
        due_date: { type: 'string' },
      },
      ['item_id'],
    ),
  },
  {
    name: 'delete_checklist_item',
    description: 'Delete a checklist item.',
    family: 'checklist',
    parameters: obj({ ...eventScope, item_id: { type: 'string' } }, ['item_id']),
  },
  {
    name: 'list_schedule',
    description: 'Schedule items.',
    family: 'schedule',
    parameters: obj(eventScope),
  },
  {
    name: 'add_schedule_item',
    description: 'Add a schedule item.',
    family: 'schedule',
    parameters: obj(
      {
        ...eventScope,
        title: { type: 'string' },
        notes: { type: 'string' },
        date: { type: 'string' },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        location: { type: 'string' },
        show_on_site: { type: 'boolean' },
      },
      ['title'],
    ),
  },
  {
    name: 'update_schedule_item',
    description: 'Update a schedule item.',
    family: 'schedule',
    parameters: obj(
      {
        ...eventScope,
        item_id: { type: 'string' },
        title: { type: 'string' },
        notes: { type: 'string' },
        date: { type: 'string' },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        location: { type: 'string' },
        show_on_site: { type: 'boolean' },
      },
      ['item_id'],
    ),
  },
  {
    name: 'delete_schedule_item',
    description: 'Delete a schedule item.',
    family: 'schedule',
    parameters: obj({ ...eventScope, item_id: { type: 'string' } }, ['item_id']),
  },
  {
    name: 'list_party',
    description: 'Wedding party roster.',
    family: 'party',
    parameters: obj(eventScope),
  },
  {
    name: 'add_party_member',
    description: 'Add a party member.',
    family: 'party',
    parameters: obj(
      {
        ...eventScope,
        name: { type: 'string' },
        role: { type: 'string' },
        side: { type: 'string' },
        group: { type: 'string' },
        bio: { type: 'string' },
        show_on_site: { type: 'boolean' },
        status: { type: 'string' },
      },
      ['name'],
    ),
  },
  {
    name: 'update_party_member',
    description: 'Update a party member.',
    family: 'party',
    parameters: obj(
      {
        ...eventScope,
        member_id: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        side: { type: 'string' },
        group: { type: 'string' },
        bio: { type: 'string' },
        show_on_site: { type: 'boolean' },
        status: { type: 'string' },
      },
      ['member_id'],
    ),
  },
  {
    name: 'delete_party_member',
    description: 'Remove a party member.',
    family: 'party',
    parameters: obj({ ...eventScope, member_id: { type: 'string' } }, ['member_id']),
  },
  {
    name: 'list_guests',
    description: 'Guests on the event.',
    family: 'guests',
    parameters: obj(eventScope),
  },
  {
    name: 'add_guest',
    description: 'Add a guest.',
    family: 'guests',
    parameters: obj(
      {
        ...eventScope,
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        note: { type: 'string' },
        plus_one_allowed: { type: 'boolean' },
        table_number: { type: 'string' },
      },
      ['first_name'],
    ),
  },
  {
    name: 'update_guest',
    description: 'Update a guest.',
    family: 'guests',
    parameters: obj(
      {
        ...eventScope,
        guest_id: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        note: { type: 'string' },
        plus_one_allowed: { type: 'boolean' },
        table_number: { type: 'string' },
      },
      ['guest_id'],
    ),
  },
  {
    name: 'delete_guest',
    description: 'Remove a guest.',
    family: 'guests',
    parameters: obj({ ...eventScope, guest_id: { type: 'string' } }, ['guest_id']),
  },
  {
    name: 'invite_guest',
    description: 'Email or text an RSVP invite. Needs UI confirm.',
    family: 'guests',
    parameters: obj(
      {
        ...eventScope,
        guest_id: { type: 'string' },
        via: { type: 'string', enum: ['email', 'sms', 'both'] },
        custom_note: { type: 'string' },
        ...confirm,
      },
      ['guest_id'],
    ),
  },
  {
    name: 'bulk_invite_guests',
    description: 'Bulk RSVP invites. Needs UI confirm.',
    family: 'guests',
    parameters: obj(
      {
        ...eventScope,
        guest_ids: { type: 'array', items: { type: 'string' } },
        via: { type: 'string', enum: ['email', 'sms', 'both'] },
        custom_note: { type: 'string' },
        ...confirm,
      },
      ['guest_ids'],
    ),
  },
  {
    name: 'list_budget',
    description: 'Budget lines.',
    family: 'budget',
    parameters: obj(eventScope),
  },
  {
    name: 'add_budget_item',
    description: 'Add a budget line.',
    family: 'budget',
    parameters: obj(
      {
        ...eventScope,
        category: { type: 'string' },
        label: { type: 'string' },
        allocated_amount: { type: 'number' },
        vendor_name: { type: 'string' },
        vendor_profile_id: { type: 'string' },
        contact_id: { type: 'string' },
      },
      ['category', 'label'],
    ),
  },
  {
    name: 'update_budget_item',
    description: 'Update a budget line.',
    family: 'budget',
    parameters: obj(
      {
        ...eventScope,
        item_id: { type: 'string' },
        label: { type: 'string' },
        allocated_amount: { type: 'number' },
        spent_amount: { type: 'number' },
        vendor_name: { type: 'string' },
      },
      ['item_id'],
    ),
  },
  {
    name: 'delete_budget_item',
    description: 'Delete a budget line.',
    family: 'budget',
    parameters: obj({ ...eventScope, item_id: { type: 'string' } }, ['item_id']),
  },
  {
    name: 'list_comments',
    description: 'Comments on a subject.',
    family: 'comments',
    parameters: obj(
      { ...eventScope, subject_type: { type: 'string' }, subject_id: { type: 'string' } },
      ['subject_type', 'subject_id'],
    ),
  },
  {
    name: 'add_comment',
    description: 'Add a comment.',
    family: 'comments',
    parameters: obj(
      {
        ...eventScope,
        subject_type: { type: 'string' },
        subject_id: { type: 'string' },
        body: { type: 'string' },
        parent_id: { type: 'string' },
      },
      ['subject_type', 'subject_id', 'body'],
    ),
  },
  {
    name: 'list_activity',
    description: 'Activity feed.',
    family: 'activity',
    parameters: obj({ ...eventScope, limit: { type: 'number' }, cursor: { type: 'string' } }),
  },
  {
    name: 'list_personal_checklists',
    description: 'Home checklist.',
    family: 'personal',
    parameters: obj({ limit: { type: 'number' }, cursor: { type: 'string' } }),
  },
  {
    name: 'add_personal_checklist',
    description: 'Add a personal checklist item.',
    family: 'personal',
    parameters: obj(
      { title: { type: 'string' }, due_date: { type: 'string' }, event_id: { type: 'string' } },
      ['title'],
    ),
  },
  {
    name: 'get_site',
    description: 'Event site editor payload.',
    family: 'site',
    parameters: obj(eventScope),
  },
  {
    name: 'create_site',
    description: 'Create a draft event site.',
    family: 'site',
    parameters: obj(
      {
        ...eventScope,
        slug: { type: 'string' },
        owner_access_mode: { type: 'string', enum: ['OPEN', 'INVITED_ONLY'] },
      },
      ['slug'],
    ),
  },
  {
    name: 'update_site',
    description: 'Patch site catalogs and sections (draft).',
    family: 'site',
    parameters: obj({
      ...eventScope,
      slug: { type: 'string' },
      theme_preset: { type: 'string' },
      font_pair: { type: 'string' },
      color_palette: { type: 'string' },
    }),
  },
  {
    name: 'publish_site',
    description: 'Publish the site. Needs UI confirm.',
    family: 'site',
    parameters: obj({ ...eventScope, ...confirm }),
  },
  {
    name: 'unpublish_site',
    description: 'Unpublish the site. Needs UI confirm.',
    family: 'site',
    parameters: obj({ ...eventScope, ...confirm }),
  },
  {
    name: 'list_members',
    description: 'Collaborators on the event.',
    family: 'members',
    parameters: obj(eventScope),
  },
  {
    name: 'invite_member',
    description: 'Invite a collaborator. Needs UI confirm.',
    family: 'members',
    parameters: obj(
      {
        ...eventScope,
        email: { type: 'string' },
        role: { type: 'string' },
        surfaces: { type: 'array', items: { type: 'string' } },
        ...confirm,
      },
      ['email'],
    ),
  },
  {
    name: 'remove_member',
    description: 'Remove a collaborator. Needs UI confirm.',
    family: 'members',
    parameters: obj({ ...eventScope, member_id: { type: 'string' }, ...confirm }, ['member_id']),
  },
  {
    name: 'search_vendors',
    description: 'Search the vendor directory.',
    family: 'vendors',
    parameters: obj({ category: { type: 'string' } }),
  },
  {
    name: 'get_vendor',
    description: 'Inspect a vendor profile.',
    family: 'vendors',
    parameters: obj({ slug: { type: 'string' } }, ['slug']),
  },
  {
    name: 'favorite_vendor',
    description: 'Save a vendor.',
    family: 'vendors',
    parameters: obj({ slug: { type: 'string' } }, ['slug']),
  },
  {
    name: 'list_favorite_vendors',
    description: 'Saved vendors.',
    family: 'vendors',
    parameters: obj({}),
  },
  {
    name: 'inquire_vendor',
    description: 'Contact a vendor. Needs UI confirm.',
    family: 'inquiries',
    parameters: obj(
      {
        vendor_profile_id: { type: 'string' },
        message: { type: 'string' },
        event_id: { type: 'string' },
        event_date: { type: 'string' },
        ...confirm,
      },
      ['vendor_profile_id', 'message'],
    ),
  },
  {
    name: 'list_inquiries',
    description: 'Inquiries this user sent.',
    family: 'inquiries',
    parameters: obj({}),
  },
  {
    name: 'list_event_inquiries',
    description: 'Inquiries on the current event.',
    family: 'inquiries',
    parameters: obj(eventScope),
  },
  {
    name: 'list_inquiry_messages',
    description: 'Messages in an inquiry.',
    family: 'inquiries',
    parameters: obj({ inquiry_id: { type: 'string' } }, ['inquiry_id']),
  },
  {
    name: 'send_inquiry_message',
    description: 'Reply on an inquiry.',
    family: 'inquiries',
    parameters: obj({ inquiry_id: { type: 'string' }, message: { type: 'string' } }, [
      'inquiry_id',
    ]),
  },
  {
    name: 'accept_quote',
    description: 'Accept a quote. Needs UI confirm.',
    family: 'inquiries',
    parameters: obj(
      { inquiry_id: { type: 'string' }, message_id: { type: 'string' }, ...confirm },
      ['inquiry_id', 'message_id'],
    ),
  },
  {
    name: 'book_vendor',
    description: 'Mark an inquiry booked. Needs UI confirm.',
    family: 'inquiries',
    parameters: obj(
      { inquiry_id: { type: 'string' }, message_id: { type: 'string' }, ...confirm },
      ['inquiry_id', 'message_id'],
    ),
  },
  {
    name: 'list_vendor_inquiries',
    description: 'Inquiries received by this vendor.',
    family: 'inquiries',
    parameters: obj({}),
  },
  {
    name: 'set_inquiry_status',
    description: 'Vendor accept or decline an inquiry.',
    family: 'inquiries',
    parameters: obj(
      {
        inquiry_id: { type: 'string' },
        status: { type: 'string', enum: ['ACCEPTED', 'DECLINED'] },
      },
      ['inquiry_id', 'status'],
    ),
  },
  {
    name: 'get_vendor_me',
    description: 'This account’s vendor profile.',
    family: 'vendors',
    parameters: obj({}),
  },
  {
    name: 'update_vendor_me',
    description: 'Update the vendor profile.',
    family: 'vendors',
    parameters: obj({
      business_name: { type: 'string' },
      bio: { type: 'string' },
      website_url: { type: 'string' },
    }),
  },
  {
    name: 'search_inspiration',
    description: 'Search inspiration.',
    family: 'inspiration',
    parameters: obj({
      q: { type: 'string' },
      category: { type: 'string' },
      limit: { type: 'number' },
    }),
  },
  {
    name: 'list_mood_board',
    description: 'Mood board membership for the event.',
    family: 'inspiration',
    parameters: obj(eventScope),
  },
  {
    name: 'add_mood_board_item',
    description: 'Save inspiration to the mood board.',
    family: 'inspiration',
    parameters: obj(
      { ...eventScope, inspiration_id: { type: 'string' }, notes: { type: 'string' } },
      ['inspiration_id'],
    ),
  },
  {
    name: 'list_notifications',
    description: 'Inbox on demand.',
    family: 'notifications',
    parameters: obj({ limit: { type: 'number' } }),
  },
  {
    name: 'list_vendor_contacts',
    description: 'Personal vendor contacts.',
    family: 'contacts',
    parameters: obj({ category: { type: 'string' } }),
  },
  {
    name: 'add_vendor_contact',
    description: 'Add a personal vendor contact.',
    family: 'contacts',
    parameters: obj(
      {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        category: { type: 'string' },
      },
      ['name'],
    ),
  },
]

const FAMILY_HINTS: Record<Exclude<ToolFamily, 'files'>, string[]> = {
  identity: ['profile', 'my name', 'switch mode', 'vendor mode', 'who am i'],
  events: ['event', 'wedding', 'ceremony', 'create an event', 'child event', 'introduction'],
  checklist: ['checklist', 'to-do', 'todo', 'task', 'assign'],
  schedule: ['schedule', 'itinerary', 'timeline', 'what time'],
  party: ['bridal party', 'groomsmen', 'bridesmaid', 'asoebi', 'party member'],
  guests: ['guest', 'rsvp', 'invite', 'plus one', 'table', 'people', 'expected'],
  navigate: ['take me', 'open the', 'go to', 'show me', 'navigate'],
  budget: ['budget', 'spend', 'cost', 'naira', 'dollars', 'allocated'],
  comments: ['comment', 'mention'],
  activity: ['activity', 'what changed', 'feed'],
  personal: ['personal checklist', 'home task'],
  site: ['website', 'event site', 'publish', 'slug', 'theme'],
  members: ['collaborator', 'planner', 'invite member', 'share access'],
  vendors: ['vendor', 'caterer', 'dj', 'photographer', 'directory'],
  inquiries: ['inquiry', 'quote', 'message the vendor', 'book'],
  inspiration: ['inspiration', 'mood board', 'look'],
  notifications: ['notification', 'inbox'],
  contacts: ['contact', 'my vendors'],
  culture: [
    'culture',
    'tribe',
    'yoruba',
    'igbo',
    'hausa',
    'custom',
    'rite',
    'bride price',
    'city',
    'lagos',
    'abuja',
  ],
}

const ALWAYS = new Set([
  'who_am_i',
  'set_current_event',
  'list_events',
  'get_event',
  'propose_navigation',
  'lookup_culture',
  'lookup_city',
])

const VENDOR_ALWAYS = new Set(['get_vendor_me', 'list_vendor_inquiries', 'set_inquiry_status'])

const MAX_TOOLS = 14

export function selectToolNames(message: string, activeMode: string): string[] {
  const text = message.toLowerCase()
  const scores = new Map<ToolFamily, number>()
  for (const [family, hints] of Object.entries(FAMILY_HINTS) as [ToolFamily, string[]][]) {
    let score = 0
    for (const hint of hints) {
      if (text.includes(hint)) score += hint.length > 8 ? 2 : 1
    }
    if (score) scores.set(family, score)
  }
  if (activeMode === 'vendor') {
    scores.set('inquiries', (scores.get('inquiries') ?? 0) + 2)
    scores.set('vendors', (scores.get('vendors') ?? 0) + 1)
  }
  const rankedFamilies = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
  const names: string[] = []
  const take = (name: string) => {
    if (!names.includes(name) && names.length < MAX_TOOLS) names.push(name)
  }
  for (const name of ALWAYS) take(name)
  if (activeMode === 'vendor') {
    for (const name of VENDOR_ALWAYS) take(name)
  }
  for (const family of rankedFamilies) {
    for (const tool of ASSISTANT_TOOLS) {
      if (tool.family === family) take(tool.name)
    }
  }
  return names
}

export function toolsForOpenAi(names: string[]) {
  const allow = new Set(names)
  return ASSISTANT_TOOLS.filter((t) => allow.has(t.name)).map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export function isCultureTool(name: string) {
  return name === 'lookup_culture' || name === 'lookup_city'
}
