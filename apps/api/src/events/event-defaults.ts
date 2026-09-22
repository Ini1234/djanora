import { VendorCategory } from '@prisma/client'

const DEFAULT_BUDGET_SPLIT: Record<VendorCategory, number> = {
  CATERER: 0.3,
  PHOTOGRAPHER: 0.12,
  VIDEOGRAPHER: 0.08,
  DECORATOR: 0.15,
  DJ: 0.08,
  MAKEUP_ARTIST: 0.07,
  MC: 0.05,
  WEDDING_PLANNER: 0.05,
  FASHION_STYLIST: 0.05,
  LIVE_BAND: 0.03,
  OTHER: 0.02,
}

const DEFAULT_BUDGET_ITEM_LABELS: Record<VendorCategory, string> = {
  CATERER: 'Catering',
  PHOTOGRAPHER: 'Photography',
  VIDEOGRAPHER: 'Videography',
  DECORATOR: 'Decor & flowers',
  DJ: 'DJ set',
  LIVE_BAND: 'Live performance',
  MAKEUP_ARTIST: 'Hair & makeup',
  MC: 'Hosting',
  WEDDING_PLANNER: 'Planning',
  FASHION_STYLIST: 'Attire',
  OTHER: 'Miscellaneous',
}

export function defaultBudgetItems(total: number) {
  return Object.entries(DEFAULT_BUDGET_SPLIT).map(([category, ratio]) => ({
    category: category as VendorCategory,
    label: DEFAULT_BUDGET_ITEM_LABELS[category as VendorCategory],
    allocatedAmount: Math.round(total * ratio),
    spentAmount: 0,
  }))
}

export function defaultChecklist(tribes: string[]) {
  const common = [
    { title: 'Set your total budget', sortOrder: 1 },
    { title: 'Choose and book your venue', sortOrder: 2 },
    { title: 'Book a caterer', sortOrder: 3 },
    { title: 'Book a photographer', sortOrder: 4 },
    { title: 'Book a videographer', sortOrder: 5 },
    { title: 'Book a DJ or live band', sortOrder: 6 },
    { title: 'Book a decorator', sortOrder: 7 },
    { title: 'Arrange event fabric / aso-ebi', sortOrder: 8 },
    { title: 'Book makeup artist', sortOrder: 9 },
    { title: 'Book an MC/compere', sortOrder: 10 },
    { title: 'Send invitations', sortOrder: 11 },
    { title: 'Arrange transportation', sortOrder: 12 },
    { title: 'Plan rehearsal', sortOrder: 13 },
  ]

  const tribeSpecific: Record<string, { title: string }[]> = {
    YORUBA: [
      { title: 'Source aso-oke and gele fabric for bride and mother' },
      { title: 'Plan alaga iduro and alaga ijoko (ceremony hosts)' },
      { title: 'Arrange palm wine for kneeling ceremony' },
      { title: 'Coordinate aso-ebi fabric for guests' },
    ],
    IGBO: [
      { title: 'Prepare oji (kola nut) for ceremony' },
      { title: 'Source george wrapper and lace fabric' },
      { title: 'Plan wine-carrying ceremony (bride finds groom)' },
      { title: 'Arrange list of items for bride price (ikpo onu)' },
    ],
    HAUSA: [
      { title: 'Plan lefe (pre-wedding gift exchange)' },
      { title: 'Arrange henna night (lalle)' },
      { title: 'Source atamfa and guinea brocade fabric' },
      { title: 'Coordinate waka music and performers' },
    ],
    IBIBIO: [
      { title: 'Source ukod inyanga (traditional bridal attire)' },
      { title: 'Plan nkuho ceremony (bride farewell by family)' },
      { title: 'Arrange usong owo (gifts and dowry presentation)' },
      { title: 'Source ofong fabric and coral beads' },
      { title: 'Coordinate traditional Ibibio music and ekpri nkuho' },
    ],
    EFIK: [
      { title: 'Source mbuoñ (traditional wrapper) and coral beads' },
      { title: 'Plan mbopo (coming-out ceremony) if applicable' },
      { title: 'Arrange bride price list (items and drinks)' },
      { title: 'Coordinate nkwa Efik music and performers' },
    ],
    IJAW: [
      { title: 'Source traditional Ijaw wrapper and hat' },
      { title: 'Arrange ekine masquerade if appropriate' },
      { title: 'Plan dowry ceremony (perebo)' },
      { title: 'Coordinate Ijaw cultural music performers' },
    ],
    URHOBO: [
      { title: 'Source ufuoma traditional attire' },
      { title: 'Plan ighele bride price negotiation' },
      { title: 'Arrange Urhobo cultural dance troupe' },
      { title: 'Source aso-ebi in Urhobo colours' },
    ],
    BINI: [
      { title: 'Source Bini traditional attire (coral beads and wrapper)' },
      { title: 'Plan isi traditional marriage rites' },
      { title: 'Arrange Bini royal music and performers' },
      { title: 'Coordinate ogiamen ceremony elements' },
    ],
    FULANI: [
      { title: 'Plan shadi (Fulani wedding celebration)' },
      { title: 'Arrange wurooji (bride gifts and dowry)' },
      { title: 'Source woven Fulani fabric and traditional dress' },
      { title: 'Coordinate ruga music and griot performers' },
    ],
    TIVI: [
      { title: 'Source gende (handwoven Tiv cloth) for bridal party' },
      { title: 'Plan swange dance performance' },
      { title: 'Arrange bride price (kuchichun) ceremony' },
      { title: 'Coordinate Tiv cultural performers' },
    ],
  }

  const seen = new Set<string>()
  const cultural: { title: string; sortOrder: number }[] = []
  let order = common.length + 1

  for (const tribe of tribes) {
    for (const item of tribeSpecific[tribe] ?? []) {
      if (!seen.has(item.title)) {
        seen.add(item.title)
        cultural.push({ title: item.title, sortOrder: order++ })
      }
    }
  }

  return [...common, ...cultural]
}
