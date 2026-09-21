'use client'

import { useId } from 'react'
import { ImagePlus } from 'lucide-react'

export function SiteFileButton({
  label,
  disabled,
  onFile,
}: {
  label: string
  disabled?: boolean
  onFile: (file: File) => void
}) {
  const id = useId()
  return (
    <div>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        className="peer sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-sm font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
          disabled ? 'pointer-events-none opacity-40' : ''
        }`}
        style={{
          background: 'color-mix(in srgb, var(--color-brand-primary) 8%, var(--color-card))',
          borderColor: 'var(--color-brand-primary)',
          color: 'var(--color-brand-primary)',
        }}
      >
        <ImagePlus size={16} aria-hidden />
        {label}
      </label>
    </div>
  )
}
