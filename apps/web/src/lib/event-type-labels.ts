export const EVENT_TYPE_LABELS: Record<string, string> = {
  WEDDING: 'Wedding',
  INTRODUCTION: 'Introduction',
  BRIDE_PRICE: 'Bride price',
  TRADITIONAL_WEDDING: 'Traditional wedding',
  COURT: 'Court',
  WHITE_WEDDING: 'White wedding',
  RECEPTION: 'Reception',
  ENGAGEMENT: 'Engagement',
  NAMING_CEREMONY: 'Naming ceremony',
  CUSTOM: 'Custom',
}

export const CEREMONY_PRESETS = [
  { value: 'INTRODUCTION', label: 'Introduction' },
  { value: 'BRIDE_PRICE', label: 'Bride price' },
  { value: 'TRADITIONAL_WEDDING', label: 'Traditional wedding' },
  { value: 'COURT', label: 'Court' },
  { value: 'WHITE_WEDDING', label: 'White wedding' },
  { value: 'RECEPTION', label: 'Reception' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'CUSTOM', label: 'Custom' },
] as const

export const TRIBE_OPTIONS = [
  { value: 'IBIBIO', label: 'Ibibio' },
  { value: 'YORUBA', label: 'Yoruba' },
  { value: 'IGBO', label: 'Igbo' },
  { value: 'EFIK', label: 'Efik' },
  { value: 'IJAW', label: 'Ijaw' },
  { value: 'HAUSA', label: 'Hausa' },
  { value: 'URHOBO', label: 'Urhobo' },
  { value: 'BINI', label: 'Bini / Edo' },
  { value: 'FULANI', label: 'Fulani' },
  { value: 'TIVI', label: 'Tiv' },
  { value: 'OTHER', label: 'Other / Mixed' },
] as const

export const THEME_OPTIONS = [
  { value: 'TRADITIONAL', label: 'Full Traditional' },
  { value: 'FUSION', label: 'Afro-Fusion' },
  { value: 'REGAL', label: 'Regal' },
  { value: 'WHITE_WEDDING', label: 'Classic White' },
  { value: 'INDOOR_LUXURY', label: 'Indoor Luxury' },
  { value: 'BLACK_TIE', label: 'Black tie' },
  { value: 'MODERN', label: 'Modern' },
  { value: 'INTIMATE', label: 'Intimate' },
  { value: 'OUTDOOR', label: 'Outdoor Garden' },
  { value: 'GARDEN', label: 'Botanical Garden' },
] as const
