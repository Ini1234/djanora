/**
 * Local helper to upsert starter Inspiration looks.
 * Production/test Azure get the same rows from
 * prisma/migrations/20260818140000_inspiration_item_categories (run by migrate deploy).
 *
 * From repo root: npm run seed:inspiration --workspace=api
 */
import 'dotenv/config'
import { InspirationCategory, InspirationVisibility, PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function createClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter: new PrismaPg(pool) })
}

const ITEMS = [
  // ── Performances ──────────────────────────────────────────────────────────
  {
    title: 'Igbo Traditional Entrance Dance',
    description:
      'A vibrant, high-energy group entrance choreography rooted in Igbo cultural traditions. Features Atilogwu acrobatic dance moves, elaborate uli body art costumes, and live ogene percussion. Perfect for couple entrances or family processions at traditional weddings.',
    category: InspirationCategory.PERFORMANCE,
    tags: [
      'igbo',
      'atilogwu',
      'traditional dance',
      'entrance',
      'cultural',
      'acrobatic',
      'ogene',
      'nigerian',
      'group dance',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 500,
    priceRangeTo: 1500,
    isAdminCurated: true,
  },
  {
    title: 'Yoruba Àgbò Dance Performance',
    description:
      'Elegant and rhythmic Yoruba traditional dance performance for wedding receptions. Dancers dressed in àṣọ-ọkè fabric perform to talking drum (ìyá ìlù) and sekere. Can be choreographed as surprise entrance, first dance alternative, or crowd entertainment.',
    category: InspirationCategory.PERFORMANCE,
    tags: [
      'yoruba',
      'agbo',
      'talking drum',
      'aso-oke',
      'wedding dance',
      'traditional',
      'sekere',
      'nigerian',
      'cultural performance',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 600,
    priceRangeTo: 2000,
    isAdminCurated: true,
  },
  {
    title: 'Hausa Durbar-Inspired Procession',
    description:
      'Majestic ceremonial procession inspired by the Northern Nigerian Durbar festival. Includes costumed riders (or performers on foot), traditional Hausa musicians playing kakaki horns, and elaborately dressed attendants. Creates an unforgettable royal entrance.',
    category: InspirationCategory.PERFORMANCE,
    tags: [
      'hausa',
      'durbar',
      'procession',
      'northern nigeria',
      'kakaki',
      'royal',
      'ceremonial',
      'entrance',
      'cultural',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 1000,
    priceRangeTo: 3000,
    isAdminCurated: true,
  },
  {
    title: 'Live Afrobeats & Highlife Band',
    description:
      'A 6-piece live band specializing in Afrobeats, Highlife, Afro-fusion, and Juju music. Perfect for keeping guests on the dance floor all night. Covers classics from Fela Kuti, Sunny Ade, and contemporary artists like Burna Boy and Wizkid. Available for 4–8 hour sets.',
    category: InspirationCategory.MUSIC,
    tags: [
      'live band',
      'afrobeats',
      'highlife',
      'afro-fusion',
      'juju',
      'fela kuti',
      'entertainment',
      'dancing',
      'nigerian music',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 2000,
    priceRangeTo: 6000,
    isAdminCurated: true,
  },
  {
    title: 'Praise Singer (Oriki Chanter)',
    description:
      'Traditional Yoruba oriki (praise poetry) chanter who personalizes your ceremony with family lineage praises. Creates deeply moving and culturally rich moments as the couple is celebrated by name, hometown, and ancestry. Often paired with talking drums.',
    category: InspirationCategory.PERFORMANCE,
    tags: [
      'oriki',
      'praise singer',
      'yoruba',
      'tradition',
      'family',
      'chanting',
      'talking drum',
      'ceremony',
      'personal',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 300,
    priceRangeTo: 800,
    isAdminCurated: true,
  },

  // ── Venues ────────────────────────────────────────────────────────────────
  {
    title: 'Grand Ballroom with Soaring 30ft Ceilings',
    description:
      'Stunning event space featuring 30-foot vaulted ceilings, floor-to-ceiling windows, and a full wraparound balcony. Accommodates 300–500 guests with space for a full stage, dance floor, and elaborate centerpiece installations. Ideal for reception or white wedding.',
    category: InspirationCategory.VENUE,
    tags: [
      'high ceilings',
      'ballroom',
      'grand',
      'large venue',
      'vaulted',
      'stage',
      'dance floor',
      'reception',
      'ottawa',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 5000,
    priceRangeTo: 15000,
    isAdminCurated: true,
  },
  {
    title: 'Heritage Hall — Exposed Brick & Timber Beams',
    description:
      'A beautifully restored 1890s heritage building with exposed red brick walls, original timber ceiling beams, and warm Edison bulb lighting. Seats up to 200 guests. The architectural character pairs beautifully with both traditional and modern African wedding aesthetics.',
    category: InspirationCategory.VENUE,
    tags: [
      'heritage',
      'exposed brick',
      'timber beams',
      'rustic',
      'historic',
      'intimate',
      'character',
      'warm lighting',
      'ottawa',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 3000,
    priceRangeTo: 8000,
    isAdminCurated: true,
  },
  {
    title: 'Outdoor Garden Pavilion',
    description:
      'A lush outdoor garden venue with a permanent open-sided pavilion, manicured lawns, and a reflecting pond. Seats up to 250 guests. Stunning backdrop for outdoor traditional ceremonies, especially during summer months. Full catering kitchen on-site.',
    category: InspirationCategory.VENUE,
    tags: [
      'outdoor',
      'garden',
      'pavilion',
      'nature',
      'summer',
      'greenery',
      'ceremony',
      'traditional',
      'lawn',
      'pond',
      'ottawa',
    ],
    location: 'Gatineau, QC',
    priceRangeFrom: 4000,
    priceRangeTo: 12000,
    isAdminCurated: true,
  },

  // ── Decor ─────────────────────────────────────────────────────────────────
  {
    title: 'Gold & Emerald Luxury Tablescapes',
    description:
      'Opulent table settings featuring deep emerald satin runners, gold charger plates, towering floral centerpieces with tropical leaves and white roses, and gold candelabras. The color combination is a crowd-favorite for both traditional and white wedding receptions.',
    category: InspirationCategory.DECOR,
    tags: [
      'gold',
      'emerald',
      'green',
      'luxury',
      'tablescapes',
      'centerpieces',
      'floral',
      'candelabra',
      'opulent',
      'reception decor',
    ],
    isAdminCurated: true,
  },
  {
    title: 'Kente Cloth Fabric Draping & Installations',
    description:
      'Striking décor installations using authentic kente cloth from Ghana as ceiling drapes, wall hangings, and table runners. Creates vibrant, culturally rich visual impact in any venue. Often paired with kola nut arrangements and traditional pottery for an immersive African aesthetic.',
    category: InspirationCategory.DECOR,
    tags: [
      'kente',
      'fabric',
      'draping',
      'ghanaian',
      'african',
      'cultural',
      'colorful',
      'textile',
      'installation',
      'ceiling',
    ],
    isAdminCurated: true,
  },
  {
    title: 'White Wedding Floral Arch & Aisle',
    description:
      'Romantic white floral ceremony arch framed with cascading white orchids, peonies, and eucalyptus. Includes full aisle petal arrangement and matching floral pew markers. Works beautifully in church settings, ballrooms, and outdoor garden venues.',
    category: InspirationCategory.DECOR,
    tags: [
      'white wedding',
      'floral arch',
      'ceremony',
      'orchids',
      'peonies',
      'eucalyptus',
      'aisle',
      'church',
      'romantic',
      'classic',
    ],
    isAdminCurated: true,
  },
  {
    title: 'Aso-Oke Canopy & Traditional Altar Setup',
    description:
      'Traditional altar setup featuring a hand-woven aso-oke fabric canopy in custom bride and groom colors, flanked by wooden carved columns, brass urns, and fresh palm fronds. Sets the scene for Yoruba, Igbo, or Edo traditional marriage ceremonies.',
    category: InspirationCategory.DECOR,
    tags: [
      'aso-oke',
      'canopy',
      'traditional altar',
      'yoruba',
      'igbo',
      'edo',
      'carved wood',
      'palm fronds',
      'brass',
      'ceremony setup',
    ],
    isAdminCurated: true,
  },

  // ── Fashion ───────────────────────────────────────────────────────────────
  {
    title: 'Custom Bridal Iro & Buba with George Wrapper',
    description:
      'Custom-made traditional bridal ensemble featuring premium george wrapper skirt, hand-embroidered buba top, and matching gele headtie. Available in any color combination. The designer incorporates modern tailoring for the perfect silhouette while honoring the traditional aesthetic.',
    category: InspirationCategory.FASHION,
    tags: [
      'iro',
      'buba',
      'george wrapper',
      'gele',
      'bridal',
      'traditional',
      'nigerian',
      'custom',
      'embroidered',
      'wedding outfit',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 800,
    priceRangeTo: 3000,
    isAdminCurated: true,
  },
  {
    title: "Men's Agbada with Hand-Embroidered Aso-Oke",
    description:
      "Regal groom's agbada set handcrafted from premium aso-oke fabric with intricate hand embroidery. Includes the full three-piece: sokoto (trousers), buba (shirt), and flowing outer agbada. Takes 4–6 weeks to produce. Available in any custom color to coordinate with bridal outfit.",
    category: InspirationCategory.FASHION,
    tags: [
      'agbada',
      'aso-oke',
      'groom',
      'embroidery',
      'traditional',
      'yoruba',
      'sokoto',
      'buba',
      'regal',
      'wedding',
      'mens fashion',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 600,
    priceRangeTo: 2500,
    isAdminCurated: true,
  },
  // ── Food ─────────────────────────────────────────────────────────────────
  {
    title: 'Nigerian Wedding Feast — Buffet Station',
    description:
      'Full Nigerian buffet featuring jollof rice (both Nigerian and party-style), egusi soup, pounded yam live station, fried plantain, pepper soup bar, small chops, and grilled suya skewers. Catered for 100–500 guests. Includes service staff, chafing dishes, and custom menus.',
    category: InspirationCategory.FOOD,
    tags: [
      'nigerian food',
      'jollof rice',
      'egusi',
      'pounded yam',
      'suya',
      'small chops',
      'buffet',
      'catering',
      'pepper soup',
      'plantain',
      'wedding feast',
    ],
    location: 'Ottawa, ON',
    priceRangeFrom: 50,
    priceRangeTo: 120,
    currency: 'CAD',
    isAdminCurated: true,
  },
]

async function main() {
  const prisma = createClient()
  console.log('Seeding inspiration items...')
  let created = 0

  for (const item of ITEMS) {
    const existing = await prisma.inspirationItem.findFirst({
      where: { title: item.title },
    })
    if (!existing) {
      await prisma.inspirationItem.create({
        data: {
          ...item,
          categories: [item.category],
          visibility: InspirationVisibility.INSPIRATION,
        } as never,
      })
      created++
    } else if (existing.visibility !== InspirationVisibility.INSPIRATION) {
      await prisma.inspirationItem.update({
        where: { id: existing.id },
        data: { visibility: InspirationVisibility.INSPIRATION },
      })
    }
  }

  console.log(`✓ Created ${created} inspiration items (${ITEMS.length - created} already existed)`)
  await prisma.$disconnect()
}

main().catch(console.error)
