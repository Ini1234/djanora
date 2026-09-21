import type { CSSProperties } from 'react'
import type { EventSiteCustomColors } from '@/lib/api.types'

export type SitePalette = {
  bg: string
  fg: string
  muted: string
  accent: string
  card: string
}

export const SITE_PALETTES: Record<string, SitePalette> = {
  'ivory-gold': {
    bg: '#f7f1e6',
    fg: '#2b2418',
    muted: '#6b5d45',
    accent: '#8a6a2f',
    card: '#fffaf1',
  },
  'stone-olive': {
    bg: '#f3f1ea',
    fg: '#1f241c',
    muted: '#5c6554',
    accent: '#4f5d3a',
    card: '#fbfaf4',
  },
  'sand-terracotta': {
    bg: '#f6eee6',
    fg: '#2c1f18',
    muted: '#7a5848',
    accent: '#b35a38',
    card: '#fff8f2',
  },
  'slate-rose': {
    bg: '#f4eef1',
    fg: '#24181d',
    muted: '#6d5560',
    accent: '#9a4d66',
    card: '#fdf8fa',
  },
  'ink-cream': {
    bg: '#161412',
    fg: '#f4efe6',
    muted: '#c4b8a4',
    accent: '#e2c48a',
    card: '#221f1b',
  },
  'sage-cream': {
    bg: '#eef4ee',
    fg: '#1d2a1f',
    muted: '#5a6b5c',
    accent: '#4a7c59',
    card: '#f7fbf7',
  },
  'navy-gold': {
    bg: '#f4f0e6',
    fg: '#1a2433',
    muted: '#5c6570',
    accent: '#b08d3e',
    card: '#fbf8f0',
  },
  'blush-wine': {
    bg: '#f8ecee',
    fg: '#3a1c24',
    muted: '#7a4e58',
    accent: '#8b3a4a',
    card: '#fff6f7',
  },
  'forest-cream': {
    bg: '#f3eee4',
    fg: '#1c2a22',
    muted: '#5a685e',
    accent: '#3d5c47',
    card: '#faf6ee',
  },
  'charcoal-copper': {
    bg: '#1c1b1a',
    fg: '#f3ece3',
    muted: '#c4b8aa',
    accent: '#c47a4a',
    card: '#2a2724',
  },
}

export const SITE_THEMES = {
  linen: { colorPalette: 'ivory-gold', fontPair: 'serif-sans' },
  ink: { colorPalette: 'ink-cream', fontPair: 'serif-serif' },
  garden: { colorPalette: 'sage-cream', fontPair: 'display-sans' },
  midnight: { colorPalette: 'charcoal-copper', fontPair: 'serif-sans' },
  clay: { colorPalette: 'sand-terracotta', fontPair: 'serif-sans' },
  frost: { colorPalette: 'slate-rose', fontPair: 'sans-sans' },
} as const

export type SiteThemePreset = keyof typeof SITE_THEMES

export function themePack(preset: string) {
  const key = preset in SITE_THEMES ? (preset as SiteThemePreset) : 'linen'
  return { themePreset: key, ...SITE_THEMES[key] }
}

function themeWash(preset: string, accent: string, fg: string) {
  if (preset === 'ink') {
    return `radial-gradient(120% 85% at 50% 0%, transparent 42%, color-mix(in srgb, #000 38%, transparent) 100%)`
  }
  if (preset === 'garden') {
    return `radial-gradient(circle at 1px 1px, color-mix(in srgb, ${accent} 28%, transparent) 1px, transparent 0)`
  }
  if (preset === 'midnight') {
    return `radial-gradient(80% 50% at 50% -10%, color-mix(in srgb, ${accent} 24%, transparent), transparent 55%), radial-gradient(120% 80% at 50% 120%, color-mix(in srgb, #000 55%, transparent), transparent 50%)`
  }
  if (preset === 'clay') {
    return `linear-gradient(165deg, color-mix(in srgb, ${accent} 16%, transparent), transparent 42%)`
  }
  if (preset === 'frost') {
    return `linear-gradient(180deg, color-mix(in srgb, #ffffff 42%, transparent), transparent 34%), repeating-linear-gradient(-18deg, color-mix(in srgb, ${fg} 6%, transparent) 0 1px, transparent 1px 16px)`
  }
  return `repeating-linear-gradient(90deg, color-mix(in srgb, ${fg} 5%, transparent) 0 1px, transparent 1px 8px), repeating-linear-gradient(0deg, color-mix(in srgb, ${fg} 5%, transparent) 0 1px, transparent 1px 8px)`
}

function themeRadius(preset: string) {
  if (preset === 'ink' || preset === 'midnight') return { card: '0.35rem', media: '0.5rem' }
  if (preset === 'garden' || preset === 'frost') return { card: '1.75rem', media: '2rem' }
  if (preset === 'clay') return { card: '0.85rem', media: '1.1rem' }
  return { card: '1.25rem', media: '1.5rem' }
}

function themeTracking(preset: string) {
  if (preset === 'ink') return '0.06em'
  if (preset === 'midnight') return '0.04em'
  if (preset === 'frost') return '0.08em'
  return '0.01em'
}

const FONTS: Record<string, { heading: string; body: string }> = {
  'serif-sans': {
    heading: 'Georgia, "Times New Roman", serif',
    body: 'system-ui, sans-serif',
  },
  'sans-sans': {
    heading: 'system-ui, sans-serif',
    body: 'system-ui, sans-serif',
  },
  'display-sans': {
    heading: 'Palatino, Georgia, serif',
    body: 'system-ui, sans-serif',
  },
  'serif-serif': {
    heading: 'Georgia, serif',
    body: 'Georgia, serif',
  },
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export function normalizeHex(raw: string) {
  const value = raw.trim()
  if (!HEX_RE.test(value)) return null
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase()
  }
  return value.toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] | null {
  const value = normalizeHex(hex)
  if (!value) return null
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ]
}

function mixHex(a: string, b: string, t: number) {
  const left = hexToRgb(a)
  const right = hexToRgb(b)
  if (!left || !right) return a
  const mix = (i: number) => Math.round(left[i] + (right[i] - left[i]) * t)
  return `#${[mix(0), mix(1), mix(2)].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function relativeLuminance(hex: string) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

export function contrastRatio(a: string, b: string) {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return (hi + 0.05) / (lo + 0.05)
}

export function bodyContrastOk(bg: string, fg: string) {
  return contrastRatio(bg, fg) >= 4.5
}

export function paletteFromCustom(colors: EventSiteCustomColors): SitePalette {
  const bg = normalizeHex(colors.bg) ?? SITE_PALETTES['ivory-gold'].bg
  const fg = normalizeHex(colors.fg) ?? SITE_PALETTES['ivory-gold'].fg
  const accent = normalizeHex(colors.accent) ?? SITE_PALETTES['ivory-gold'].accent
  const muted = colors.muted
    ? (normalizeHex(colors.muted) ?? mixHex(fg, bg, 0.45))
    : mixHex(fg, bg, 0.45)
  const card = colors.card
    ? (normalizeHex(colors.card) ??
      mixHex(bg, relativeLuminance(bg) < 0.4 ? '#000000' : '#ffffff', 0.18))
    : mixHex(bg, relativeLuminance(bg) < 0.4 ? '#000000' : '#ffffff', 0.18)
  return { bg, fg, muted, accent, card }
}

export function resolveSitePalette(look: {
  colorPalette: string
  customColors?: EventSiteCustomColors | null
}): SitePalette {
  if (look.colorPalette === 'custom' && look.customColors) {
    return paletteFromCustom(look.customColors)
  }
  return SITE_PALETTES[look.colorPalette] ?? SITE_PALETTES['ivory-gold']
}

export function siteLookVars(look: {
  themePreset?: string
  colorPalette: string
  fontPair: string
  customColors?: EventSiteCustomColors | null
}) {
  const palette = resolveSitePalette(look)
  const fonts = FONTS[look.fontPair] ?? FONTS['serif-sans']
  const theme = look.themePreset || 'linen'
  const radius = themeRadius(theme)
  return {
    backgroundColor: palette.bg,
    backgroundImage: themeWash(theme, palette.accent, palette.fg),
    backgroundSize: theme === 'garden' ? '22px 22px' : undefined,
    color: palette.fg,
    fontFamily: fonts.body,
    '--site-bg': palette.bg,
    '--site-fg': palette.fg,
    '--site-muted': palette.muted,
    '--site-accent': palette.accent,
    '--site-card': palette.card,
    '--site-heading': fonts.heading,
    '--site-body': fonts.body,
    '--site-radius': radius.card,
    '--site-radius-lg': radius.media,
    '--site-heading-tracking': themeTracking(theme),
  } as CSSProperties
}

export function buttonClass(style: string) {
  if (style === 'square')
    return 'inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold'
  if (style === 'underline')
    return 'inline-flex min-h-11 items-center border-b-2 bg-transparent px-1 py-1 text-sm font-semibold'
  return 'inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold'
}
