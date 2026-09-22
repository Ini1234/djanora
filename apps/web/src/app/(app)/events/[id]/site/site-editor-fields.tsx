import type { ReactNode } from 'react'
import type { EventSiteSectionLayout } from '@/lib/api.types'
import { normalizeHex } from '@/app/e/[slug]/site-look'

export const fieldStyle = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

export function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export function CatalogToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (next: T) => void
}) {
  const pills = (
    <div
      className="flex flex-wrap rounded-full border p-0.5"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {options.map(([id, title]) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="min-h-11 rounded-full px-3 text-sm font-medium"
          style={{
            background: value === id ? 'var(--color-brand-primary)' : 'transparent',
            color: value === id ? 'var(--color-primary-foreground)' : 'var(--color-muted)',
          }}
        >
          {title}
        </button>
      ))}
    </div>
  )
  if (!label) return pills
  return (
    <div>
      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </p>
      {pills}
    </div>
  )
}

export function LayoutToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: EventSiteSectionLayout
  onChange: (next: EventSiteSectionLayout) => void
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </p>
      <div
        className="flex flex-wrap rounded-full border p-0.5"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {(
          [
            ['vertical', 'Stacked'],
            ['horizontal', 'Side by side'],
          ] as const
        ).map(([layout, title]) => (
          <button
            key={layout}
            type="button"
            aria-pressed={value === layout}
            onClick={() => onChange(layout)}
            className="min-h-11 rounded-full px-3 text-sm font-medium"
            style={{
              background: value === layout ? 'var(--color-brand-primary)' : 'transparent',
              color: value === layout ? 'var(--color-primary-foreground)' : 'var(--color-muted)',
            }}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  )
}

export function LookChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (next: T) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([id, title]) => {
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(id)}
              className="min-h-11 rounded-full border px-3 text-sm"
              style={{
                borderColor: selected ? 'var(--color-brand-primary)' : 'var(--color-border)',
                color: selected ? 'var(--color-brand-primary)' : 'var(--color-muted)',
              }}
            >
              {title}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function HexField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const picker = normalizeHex(value) ?? '#000000'
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={picker}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color`}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border"
          style={{ borderColor: 'var(--color-border)', background: 'transparent' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1a1a1a"
          maxLength={7}
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
          style={fieldStyle}
        />
      </div>
    </label>
  )
}
