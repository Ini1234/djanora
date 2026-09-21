'use client'

import type { EventSiteImage } from '@/lib/api.types'
import { SiteFileButton } from './site-file-button'

const HERO_TYPES = new Set([
  'ABOUT',
  'DRESS_CODE',
  'STAY',
  'TRAVEL',
  'WHERE',
  'SCHEDULE',
  'FAQ',
  'GIFTS',
  'RSVP',
  'CUSTOM',
])

export function canHaveHero(type: string) {
  return HERO_TYPES.has(type)
}

export function SectionImageField({
  image,
  disabled,
  onUpload,
  onRemove,
}: {
  image?: EventSiteImage
  disabled?: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium" style={{ color: 'var(--color-muted)' }}>
        Section image
      </p>
      {image?.url && (
        <div className="relative w-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt || ''}
            className="h-20 w-32 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 rounded bg-black/60 px-1.5 text-[10px] text-white"
          >
            Remove
          </button>
        </div>
      )}
      <SiteFileButton
        label={image?.url ? 'Replace image' : 'Choose image'}
        disabled={disabled}
        onFile={onUpload}
      />
      {disabled && (
        <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          Save the site first, then add a photo.
        </p>
      )}
    </div>
  )
}
