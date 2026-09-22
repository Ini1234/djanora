/**
 * Product theme dictionary. Components must use semantic Tailwind utilities
 * (`text-fg`, `bg-surface`, `border-border`) — never light/dark color pairs.
 *
 * Runtime values live as CSS variables on `[data-theme]`. Adding a theme is
 * another entry here plus a matching `[data-theme='…']` block in globals.css.
 */

export const themeIds = ['light', 'dark'] as const
export type ThemeId = (typeof themeIds)[number]

export type ThemeTokens = {
  canvas: string
  page: string
  surface: string
  'surface-hover': string
  fg: string
  muted: string
  border: string
  input: string
  ring: string
  primary: string
  'primary-fg': string
  'primary-hover': string
  secondary: string
  'secondary-fg': string
  nav: string
  'nav-fg': string
  'nav-muted': string
  'nav-border': string
  'nav-hover': string
  'nav-active': string
  hover: string
  overlay: string
  inverse: string
  'inverse-fg': string
  'inverse-muted': string
  danger: string
  success: string
  warning: string
  disabled: string
}

export const themes: Record<ThemeId, ThemeTokens> = {
  light: {
    canvas: '#fafafa',
    page: '#f4f4f5',
    surface: '#ffffff',
    'surface-hover': '#f4f4f5',
    fg: '#18181b',
    muted: '#52525b',
    border: '#e4e4e7',
    input: '#ffffff',
    ring: '#18181b',
    primary: '#18181b',
    'primary-fg': '#ffffff',
    'primary-hover': '#27272a',
    secondary: '#ffffff',
    'secondary-fg': '#18181b',
    nav: '#ffffff',
    'nav-fg': '#18181b',
    'nav-muted': '#52525b',
    'nav-border': '#e4e4e7',
    'nav-hover': 'rgba(0, 0, 0, 0.05)',
    'nav-active': 'color-mix(in srgb, #18181b 18%, transparent)',
    hover: 'rgba(0, 0, 0, 0.05)',
    overlay: 'rgba(0, 0, 0, 0.4)',
    inverse: '#18181b',
    'inverse-fg': '#fafafa',
    'inverse-muted': '#a1a1aa',
    danger: '#dc2626',
    success: '#16a34a',
    warning: '#d97706',
    disabled: 'rgba(24, 24, 27, 0.4)',
  },
  dark: {
    canvas: '#09090b',
    page: '#18181b',
    surface: '#18181b',
    'surface-hover': 'rgba(255, 255, 255, 0.06)',
    fg: '#fafafa',
    muted: '#a1a1aa',
    border: '#27272a',
    input: '#18181b',
    ring: '#fafafa',
    primary: '#fafafa',
    'primary-fg': '#18181b',
    'primary-hover': '#e4e4e7',
    secondary: 'transparent',
    'secondary-fg': '#fafafa',
    nav: '#09090b',
    'nav-fg': '#fafafa',
    'nav-muted': '#a1a1aa',
    'nav-border': 'rgba(255, 255, 255, 0.08)',
    'nav-hover': 'rgba(255, 255, 255, 0.06)',
    'nav-active': 'color-mix(in srgb, #fafafa 18%, transparent)',
    hover: 'rgba(255, 255, 255, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    inverse: '#18181b',
    'inverse-fg': '#fafafa',
    'inverse-muted': '#a1a1aa',
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    disabled: 'rgba(250, 250, 250, 0.4)',
  },
}

export type ThemeToken = keyof ThemeTokens
