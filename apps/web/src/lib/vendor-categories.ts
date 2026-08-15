/**
 * Canonical vendor category keys — single source of truth.
 * These match the `VendorCategory` enum in the Prisma schema.
 *
 * Labels are stored in messages/en.json and messages/fr.json under
 * the `vendorCategories` namespace so they can be translated.
 *
 * Usage (client component):
 *   const t = useTranslations('vendorCategories')
 *   const label = t(category.value)  // e.g. t('PHOTOGRAPHER')
 *
 * Usage (server component):
 *   const t = await getTranslations('vendorCategories')
 *   const label = t(category.value)
 */

export type VendorCategoryKey =
  | 'CATERER'
  | 'PHOTOGRAPHER'
  | 'VIDEOGRAPHER'
  | 'DECORATOR'
  | 'DJ'
  | 'LIVE_BAND'
  | 'MAKEUP_ARTIST'
  | 'MC'
  | 'WEDDING_PLANNER'
  | 'FASHION_STYLIST'
  | 'OTHER'

/** Ordered list of category keys (order matches Prisma enum) */
export const VENDOR_CATEGORY_KEYS: VendorCategoryKey[] = [
  'CATERER',
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'DECORATOR',
  'DJ',
  'LIVE_BAND',
  'MAKEUP_ARTIST',
  'MC',
  'WEDDING_PLANNER',
  'FASHION_STYLIST',
  'OTHER',
]

/**
 * English fallback labels — used in non-i18n contexts (e.g. backend logs,
 * meta tags, or anywhere you cannot call `useTranslations`).
 */
export const VENDOR_CATEGORY_LABELS_EN: Record<VendorCategoryKey, string> = {
  CATERER:        'Caterer / Food',
  PHOTOGRAPHER:   'Photographer',
  VIDEOGRAPHER:   'Videographer',
  DECORATOR:      'Decorator / Florist',
  DJ:             'DJ',
  LIVE_BAND:      'Live Band / Musician',
  MAKEUP_ARTIST:  'Makeup Artist / Beauty',
  MC:             'MC / Host / Compere',
  WEDDING_PLANNER:'Wedding Planner',
  FASHION_STYLIST:'Fashion Stylist / Fabric',
  OTHER:          'Other service',
}

/**
 * Returns the localized label for a category key.
 * Pass the `t` function from `useTranslations('vendorCategories')`.
 */
export function getVendorCategoryLabel(
  key: string,
  t?: (k: string) => string,
): string {
  if (t) {
    try { return t(key) } catch { /* fall through */ }
  }
  return VENDOR_CATEGORY_LABELS_EN[key as VendorCategoryKey] ?? key
}
