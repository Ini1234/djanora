export type CultureNote = {
  tribe: string
  ceremony?: string
  title: string
  summary: string
  typicalSequence?: string[]
  checklistHints?: string[]
  budgetHints?: string[]
  source: string
}

export type CityNote = {
  city: string
  country: string
  summary: string
  season?: string
  venues?: string
  guests?: string
  source: string
}

const SOURCE =
  'Djanora founder pack. Common diaspora planning notes, not religious or legal advice. Confirm with family and elders.'

export const CULTURE_PACKS: CultureNote[] = [
  {
    tribe: 'YORUBA',
    title: 'Yoruba wedding path',
    summary:
      'A Yoruba wedding is often several gatherings, not one day. Families typically meet first (introduction), then a traditional wedding with aso-oke and family rites, then a court or white wedding if the couple wants a civil or church record. Fusion is common in the diaspora.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'COURT', 'WHITE_WEDDING', 'RECEPTION'],
    checklistHints: [
      'Agree which ceremonies you are actually hosting',
      'Set a shared budget pot before decorating any one day',
      'Ask both families who must be present at the introduction',
    ],
    source: SOURCE,
  },
  {
    tribe: 'YORUBA',
    ceremony: 'INTRODUCTION',
    title: 'Yoruba introduction',
    summary:
      'The introduction is a smaller family meeting. The couple and close relatives are formally presented. It is not the full traditional wedding. Keep the guest list tight, agree the date with both families first, and decide what will be offered as drinks and kola. Do not invent bride-price figures here; that is a later family conversation if it applies.',
    checklistHints: [
      'Confirm both families can attend',
      'Book a home or small hall, not a ballroom',
      'Assign one person to greet elders',
    ],
    budgetHints: ['Venue or home setup', 'Refreshments', 'Small thank-you gifts'],
    source: SOURCE,
  },
  {
    tribe: 'YORUBA',
    ceremony: 'TRADITIONAL_WEDDING',
    title: 'Yoruba traditional wedding',
    summary:
      'The traditional wedding is the public cultural ceremony: families, aso-oke or coordinated attire, music, and the rites the families have agreed. Details vary by family and town. Use this event for the traditional outfit, MC, live band or DJ, and the people who must sit with the parents.',
    checklistHints: [
      'Lock traditional outfits early (aso-oke lead times are long)',
      'Name who speaks for each family',
      'Decide whether the reception is the same night or a later event',
    ],
    budgetHints: ['Attire', 'MC / music', 'Decor', 'Food'],
    source: SOURCE,
  },
  {
    tribe: 'IGBO',
    title: 'Igbo wedding path',
    summary:
      'Igbo weddings often separate the family inquiry (introduction / knocking), bride price discussions, the traditional marriage (igba nkwu or the family’s named rite), then court and/or white wedding. Sequence and names differ by town. Ask the families which gatherings they expect before you book venues.',
    typicalSequence: [
      'INTRODUCTION',
      'BRIDE_PRICE',
      'TRADITIONAL_WEDDING',
      'COURT',
      'WHITE_WEDDING',
    ],
    checklistHints: [
      'Write down the gatherings both families named',
      'Keep bride-price talks off the public guest list',
      'Treat traditional and white as separate budgets if they are separate days',
    ],
    source: SOURCE,
  },
  {
    tribe: 'IGBO',
    ceremony: 'INTRODUCTION',
    title: 'Igbo introduction / knocking',
    summary:
      'This is the first formal family visit, often smaller than the traditional marriage. The visiting family is received; the purpose is to be known, not to finish every rite. Guest count stays close-family unless both sides say otherwise.',
    checklistHints: [
      'Confirm who must travel',
      'Agree what to bring as a visit (families decide; do not copy a blog list)',
      'Keep speeches short and elder-led',
    ],
    budgetHints: ['Travel', 'Visit items the family specified', 'A modest reception at the house'],
    source: SOURCE,
  },
  {
    tribe: 'IGBO',
    ceremony: 'BRIDE_PRICE',
    title: 'Bride price (family negotiation)',
    summary:
      'Bride price is a family negotiation, not a public party and not a number Djanora can set. Create a private ceremony on the checklist if you need dates and owners. Invite only the people the families named. Do not publish a site section for this unless the couple asked to.',
    checklistHints: [
      'List the people both families said must be in the room',
      'Keep documents and lists with one trusted person',
      'Hide this ceremony from collaborators who should not see it',
    ],
    budgetHints: ['Only what the families agreed. Do not estimate a “typical” amount.'],
    source: SOURCE,
  },
  {
    tribe: 'HAUSA',
    title: 'Hausa wedding path',
    summary:
      'Hausa weddings are often multi-day and faith-shaped (for many families, Islamic rites such as Fatihah sit beside social events like Kamu, Sa Lefe, and the reception). Exact names and order are family-specific. Ask which gatherings they want before creating events.',
    typicalSequence: ['ENGAGEMENT', 'TRADITIONAL_WEDDING', 'RECEPTION'],
    checklistHints: [
      'Ask which social days vs religious rites you are hosting',
      'Plan attire changes if there are multiple appearances',
      'Confirm gender-space and photography rules with the families',
    ],
    source: SOURCE,
  },
  {
    tribe: 'IBIBIO',
    title: 'Ibibio wedding path',
    summary:
      'Ibibio and closely related Cross River families often hold an introduction, a traditional marriage with family rites, then court or church. Food, attire, and who speaks are family decisions. Use separate events if traditional and white are different days.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING', 'RECEPTION'],
    source: SOURCE,
  },
  {
    tribe: 'EFIK',
    title: 'Efik wedding path',
    summary:
      'Efik weddings may include a traditional marriage with distinctive attire and family hospitality, then a church or court wedding. Fat-tening room and other heritage rites are family-specific; only add them if the couple named them.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING'],
    source: SOURCE,
  },
  {
    tribe: 'IJAW',
    title: 'Ijaw wedding path',
    summary:
      'Ijaw marriages typically involve family meetings and a traditional ceremony before any church or court date. Riverine travel and guest lodging matter when families are split across towns. Ask both sides which rites they expect.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING'],
    source: SOURCE,
  },
  {
    tribe: 'URHOBO',
    title: 'Urhobo wedding path',
    summary:
      'Urhobo weddings usually include family introduction and a traditional marriage. Bride-price or list conversations, if any, stay with the families. Split traditional and white into two events when they are different days.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING'],
    source: SOURCE,
  },
  {
    tribe: 'BINI',
    title: 'Bini / Edo wedding path',
    summary:
      'Bini (Edo) weddings commonly include family introduction and a traditional ceremony, then church or court. Palace or family-specific rites exist for some lineages; only plan them if the family asked.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING'],
    source: SOURCE,
  },
  {
    tribe: 'FULANI',
    title: 'Fulani wedding path',
    summary:
      'Fulani weddings vary widely by region and faith. Many families hold a religious rite plus a social gathering. Do not invent a single “standard Fulani program.” Ask which events they want created.',
    typicalSequence: ['ENGAGEMENT', 'TRADITIONAL_WEDDING', 'RECEPTION'],
    source: SOURCE,
  },
  {
    tribe: 'TIVI',
    title: 'Tiv wedding path',
    summary:
      'Tiv marriages typically involve family consent and a traditional celebration, then a civil or church wedding if desired. Confirm the gatherings with both families before sending invites.',
    typicalSequence: ['INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING'],
    source: SOURCE,
  },
  {
    tribe: 'OTHER',
    title: 'Custom / mixed heritage',
    summary:
      'When the couple is mixed-heritage or the tribe is not in this list, do not borrow another tribe’s rites. Create custom-named ceremonies the couple actually wants, and keep culture notes to what they told you.',
    typicalSequence: ['CUSTOM'],
    checklistHints: ['Write the ceremony names in the couple’s words'],
    source: SOURCE,
  },
  {
    tribe: 'YORUBA',
    ceremony: 'WHITE_WEDDING',
    title: 'White / church wedding (Yoruba families)',
    summary:
      'The white wedding is the church or formal Western-style ceremony. It is often a different day from the traditional wedding. Guest list, photography rules, and whether traditional attire appears in portraits are couple decisions.',
    checklistHints: ['Book the officiant and venue first', 'Decide if the reception is attached'],
    budgetHints: ['Venue', 'Attire', 'Photography', 'Reception if same day'],
    source: SOURCE,
  },
  {
    tribe: 'IGBO',
    ceremony: 'TRADITIONAL_WEDDING',
    title: 'Igbo traditional marriage',
    summary:
      'The traditional marriage is the public cultural wedding. Names and rites differ (igba nkwu and others). Plan attire, food, MC, and the people who sit with each family. Do not copy another town’s list onto this event.',
    checklistHints: [
      'Confirm the name the family uses for this day',
      'Lock traditional attire early',
      'Decide if wine-carrying or other rites are happening (family says)',
    ],
    source: SOURCE,
  },
]

export const CITY_PACKS: CityNote[] = [
  {
    city: 'Lagos',
    country: 'Nigeria',
    summary:
      'Lagos is the most common Nigeria wedding city in this product: traffic, humidity, and venue lead times dominate the plan. Build buffers between ceremonies on the same day. Weekend luxury venues book out far ahead.',
    season:
      'November–March is the usual dry-season window. April–October brings heavier rain; outdoor plans need a solid indoor backup. Harmattan haze can affect outdoor photos in late December–January.',
    venues:
      'Hotels and event halls on the Island and mainland both work; Island venues cost more and need earlier guest-travel plans. Home introductions are common for the first family meeting.',
    guests:
      'Assume 60–90 minutes of traffic between Island and mainland at peak. Tell diaspora guests to arrive a day early and not book same-day inter-city flights before an evening event.',
    source: SOURCE,
  },
  {
    city: 'Abuja',
    country: 'Nigeria',
    summary:
      'Abuja is more spread out and formal-venue heavy. Distances are long; cluster events in one district when you can. Security and hotel blocks matter for government-area venues.',
    season:
      'November–February is typically drier and dusty (harmattan). Rainy season is roughly April–October. Outdoor garden weddings still need shade and a rain plan.',
    venues:
      'Hotels and purpose-built halls are the default. Estate / garden venues need generator and parking plans.',
    guests:
      'Airport to many hotels is a real transfer, not a short hop. Put hotel names on the event site stay section.',
    source: SOURCE,
  },
  {
    city: 'Port Harcourt',
    country: 'Nigeria',
    summary:
      'Port Harcourt weddings often mix hotel halls and family compounds. Rain and road conditions matter more than in Abuja. If guests fly in, publish airport-to-venue timing on the site.',
    season: 'Rain is frequent much of the year; a covered plan is the default, not a backup.',
    venues: 'Hotels and compounds. Confirm generator and catering access for compound events.',
    guests:
      'Many guests come from Lagos or the diaspora via a connection. Avoid tight same-day arrivals.',
    source: SOURCE,
  },
  {
    city: 'London',
    country: 'United Kingdom',
    summary:
      'London diaspora weddings are hall- and church-driven, with council licensing for some venues. Traditional and white events are often different weekends because halls and churches book separately.',
    season: 'Outdoor UK plans are weather-fragile year-round. Winter daylight is short for photos.',
    venues:
      'Town halls, churches, and hired halls. Confirm alcohol, music-end times, and capacity in writing.',
    guests:
      'Nigeria-based family need visas and long lead times. Publish a stay list early. Do not assume everyone can attend both traditional and white if they are on consecutive days.',
    source: SOURCE,
  },
  {
    city: 'Houston',
    country: 'United States',
    summary:
      'Houston has a large Nigerian diaspora and many halls that already run Nigerian receptions. Heat and parking are the practical constraints. Traditional and reception can share a weekend if you leave travel slack.',
    season:
      'June–September is very hot and humid; indoor reception is the default. Hurricane season is June–November on the Gulf.',
    venues: 'Banquet halls and churches. Ask about leftover-food rules and vendor load-in hours.',
    guests:
      'Domestic US flights are easier than UK visas, but Nigeria-based elders still need time. Offer a hotel block.',
    source: SOURCE,
  },
  {
    city: 'Toronto',
    country: 'Canada',
    summary:
      'Toronto / GTA halls book early for Saturday Nigerian weddings. Winter makes travel and attire logistics real. Many couples split traditional and white across two Saturdays.',
    season:
      'November–March is cold and snow-risk. Outdoor portraits need a short, indoor-backed plan.',
    venues:
      'Banquet halls, churches, and hotel ballrooms. Confirm union / overtime rules for late music.',
    guests:
      'Pearson transfers and winter storms delay elders. Put transit and parking on the event site.',
    source: SOURCE,
  },
  {
    city: 'Ottawa',
    country: 'Canada',
    summary:
      'Ottawa venues are fewer than Toronto; Saturday halls go early. Winter is harsher. Many guests will fly or drive from Toronto or Montreal.',
    season: 'November–March: snow, ice, early dark. Build indoor everything.',
    venues: 'Hotels, halls, and churches. Capacity is tighter; RSVP discipline matters.',
    guests:
      'Publish driving time from Toronto/Montreal and a hotel list. Do not plan outdoor ceremonies in winter.',
    source: SOURCE,
  },
  {
    city: 'Accra',
    country: 'Ghana',
    summary:
      'Accra is a common West African destination wedding city. Heat, traffic, and Sunday church schedules shape the day. Confirm what traditional rites you are actually hosting; Ghanaian and Nigerian programs are not interchangeable.',
    season:
      'Generally hot. Major rains cluster around May–June and September–October in many years; always keep a covered plan.',
    venues: 'Hotels and gardens. Confirm generator and photography permissions.',
    guests:
      'International guests need a rest day. Do not stack introduction and traditional on the arrival evening.',
    source: SOURCE,
  },
]

const TRIBE_ALIASES: Record<string, string> = {
  yoruba: 'YORUBA',
  igbo: 'IGBO',
  hausa: 'HAUSA',
  ibibio: 'IBIBIO',
  efik: 'EFIK',
  ijaw: 'IJAW',
  urhobo: 'URHOBO',
  bini: 'BINI',
  edo: 'BINI',
  fulani: 'FULANI',
  tiv: 'TIVI',
  tivi: 'TIVI',
  other: 'OTHER',
  mixed: 'OTHER',
}

const CEREMONY_ALIASES: Record<string, string> = {
  introduction: 'INTRODUCTION',
  knocking: 'INTRODUCTION',
  'bride price': 'BRIDE_PRICE',
  brideprice: 'BRIDE_PRICE',
  traditional: 'TRADITIONAL_WEDDING',
  'traditional wedding': 'TRADITIONAL_WEDDING',
  court: 'COURT',
  white: 'WHITE_WEDDING',
  'white wedding': 'WHITE_WEDDING',
  church: 'WHITE_WEDDING',
  reception: 'RECEPTION',
  engagement: 'ENGAGEMENT',
  naming: 'NAMING_CEREMONY',
  'naming ceremony': 'NAMING_CEREMONY',
}

function norm(value: string) {
  return value.trim().toLowerCase()
}

export function resolveTribe(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, '_')
  if (CULTURE_PACKS.some((p) => p.tribe === raw)) return raw
  return TRIBE_ALIASES[norm(input)] ?? null
}

export function resolveCeremony(input?: string): string | undefined {
  if (!input?.trim()) return undefined
  const raw = input.trim().toUpperCase().replace(/\s+/g, '_')
  if (
    [
      'WEDDING',
      'INTRODUCTION',
      'BRIDE_PRICE',
      'TRADITIONAL_WEDDING',
      'COURT',
      'WHITE_WEDDING',
      'RECEPTION',
      'ENGAGEMENT',
      'NAMING_CEREMONY',
      'CUSTOM',
    ].includes(raw)
  ) {
    return raw
  }
  return CEREMONY_ALIASES[norm(input)]
}

export function lookupCulture(tribeInput: string, ceremonyInput?: string): CultureNote | null {
  const tribe = resolveTribe(tribeInput)
  if (!tribe) return null
  const ceremony = resolveCeremony(ceremonyInput)
  if (ceremony) {
    const exact = CULTURE_PACKS.find((p) => p.tribe === tribe && p.ceremony === ceremony)
    if (exact) return exact
  }
  return CULTURE_PACKS.find((p) => p.tribe === tribe && !p.ceremony) ?? null
}

export function lookupCity(cityInput: string): CityNote | null {
  const q = norm(cityInput)
  if (!q) return null
  return (
    CITY_PACKS.find((c) => norm(c.city) === q) ??
    CITY_PACKS.find((c) => q.includes(norm(c.city)) || norm(c.city).includes(q)) ??
    null
  )
}

export function listedTribes() {
  return [...new Set(CULTURE_PACKS.map((p) => p.tribe))]
}

export function listedCities() {
  return CITY_PACKS.map((c) => `${c.city}, ${c.country}`)
}
