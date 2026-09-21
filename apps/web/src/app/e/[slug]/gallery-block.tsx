'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { EventSitePhotosSize, EventSitePhotosStyle } from '@/lib/api.types'

const GRID: Record<EventSitePhotosSize, string> = {
  small: 'grid grid-cols-3 gap-2 sm:grid-cols-4',
  medium: 'grid grid-cols-2 gap-2 sm:grid-cols-3',
  large: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
}

const GRID_IMG: Record<EventSitePhotosSize, string> = {
  small: 'h-24 w-full rounded-xl object-cover sm:h-28',
  medium: 'h-36 w-full rounded-xl object-cover sm:h-40',
  large: 'h-56 w-full rounded-xl object-cover sm:h-72',
}

const STAGE: Record<EventSitePhotosSize, string> = {
  small: 'h-56 sm:h-64',
  medium: 'h-72 sm:h-80',
  large: 'h-[22rem] sm:h-[32rem]',
}

function photosStyleOf(raw?: EventSitePhotosStyle): EventSitePhotosStyle {
  return raw === 'slider' ? 'slider' : 'grid'
}

function photosSizeOf(raw?: EventSitePhotosSize): EventSitePhotosSize {
  return raw === 'small' || raw === 'large' ? raw : 'medium'
}

function photoLabel(index: number, total: number) {
  return `Photo ${index + 1} of ${total}`
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function GalleryBlock({
  photos,
  photosStyle,
  photosSize,
  emptyLabel,
}: {
  photos: { id: string; url: string }[]
  photosStyle?: EventSitePhotosStyle
  photosSize?: EventSitePhotosSize
  emptyLabel?: string
}) {
  const style = photosStyleOf(photosStyle)
  const size = photosSizeOf(photosSize)
  const [open, setOpen] = useState<number | null>(null)
  const closeViewer = useCallback(() => setOpen(null), [])

  if (photos.length === 0) {
    return emptyLabel ? (
      <p className="text-sm" style={{ color: 'var(--site-muted)' }}>
        {emptyLabel}
      </p>
    ) : null
  }

  return (
    <>
      {style === 'slider' ? (
        <PhotoSlideshow photos={photos} size={size} onOpen={setOpen} />
      ) : (
        <div className={GRID[size]}>
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={`View ${photoLabel(index, photos.length)}`}
              className="relative min-h-11 overflow-hidden"
              style={{ borderRadius: 'var(--site-radius-lg, 0.75rem)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className={GRID_IMG[size]} />
            </button>
          ))}
        </div>
      )}
      {open != null && (
        <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={closeViewer} />
      )}
    </>
  )
}

function PhotoSlideshow({
  photos,
  size,
  onOpen,
}: {
  photos: { id: string; url: string }[]
  size: EventSitePhotosSize
  onOpen: (index: number) => void
}) {
  const [index, setIndex] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; moved: boolean } | null>(null)
  const photo = photos[index]
  const total = photos.length

  const go = useCallback(
    (next: number) => {
      setIndex(((next % total) + total) % total)
    },
    [total],
  )

  useEffect(() => {
    const active = stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
    active?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [index])

  if (!photo) return null

  return (
    <div
      className="space-y-3"
      role="region"
      aria-roledescription="carousel"
      aria-label="Photo gallery"
    >
      <div
        className={`relative overflow-hidden ${STAGE[size]}`}
        style={{ borderRadius: 'var(--site-radius-lg, 0.75rem)', background: 'var(--site-card)' }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          pointer.current = { x: event.clientX, moved: false }
        }}
        onPointerMove={(event) => {
          if (!pointer.current) return
          if (Math.abs(event.clientX - pointer.current.x) > 8) pointer.current.moved = true
        }}
        onPointerUp={(event) => {
          const start = pointer.current
          pointer.current = null
          if (!start) return
          const dx = event.clientX - start.x
          if (start.moved && Math.abs(dx) > 40 && total > 1) {
            go(index + (dx < 0 ? 1 : -1))
            return
          }
          if (!start.moved) onOpen(index)
        }}
        onPointerCancel={() => {
          pointer.current = null
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photoLabel(index, total)}
          className="pointer-events-none h-full w-full object-cover"
          draggable={false}
        />
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(event) => {
                event.stopPropagation()
                go(index - 1)
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute top-1/2 left-2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--site-card) 88%, transparent)',
                color: 'var(--site-fg)',
              }}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(event) => {
                event.stopPropagation()
                go(index + 1)
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute top-1/2 right-2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full"
              style={{
                background: 'color-mix(in srgb, var(--site-card) 88%, transparent)',
                color: 'var(--site-fg)',
              }}
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <p
          className="pointer-events-none absolute right-3 bottom-3 rounded-full px-2.5 py-1 text-xs"
          style={{
            background: 'color-mix(in srgb, var(--site-card) 88%, transparent)',
            color: 'var(--site-fg)',
          }}
        >
          {index + 1} / {total}
        </p>
      </div>
      {total > 1 && (
        <div
          ref={stripRef}
          className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((item, thumbIndex) => {
            const current = thumbIndex === index
            return (
              <button
                key={item.id}
                type="button"
                data-thumb={thumbIndex}
                aria-label={`Show ${photoLabel(thumbIndex, total)}`}
                aria-current={current}
                onClick={() => go(thumbIndex)}
                className="h-16 w-16 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20"
                style={{
                  boxShadow: current ? '0 0 0 2px var(--site-accent, var(--site-fg))' : undefined,
                  opacity: current ? 1 : 0.7,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: { id: string; url: string }[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)
  indexRef.current = index
  const photo = photos[index]
  const total = photos.length

  useEffect(() => {
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      const current = indexRef.current
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowLeft' && total > 1) {
        event.preventDefault()
        onIndex((current - 1 + total) % total)
        return
      }
      if (event.key === 'ArrowRight' && total > 1) {
        event.preventDefault()
        onIndex((current + 1) % total)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
      ]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previously?.focus()
    }
  }, [onClose, onIndex, total])

  if (!photo) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 motion-reduce:transition-none"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        aria-label="Close photo"
        onClick={onClose}
        className="absolute top-3 right-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
      >
        <X size={20} />
      </button>
      {total > 1 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={(event) => {
            event.stopPropagation()
            onIndex((index - 1 + total) % total)
          }}
          className="absolute top-1/2 left-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {total > 1 && (
        <button
          type="button"
          aria-label="Next photo"
          onClick={(event) => {
            event.stopPropagation()
            onIndex((index + 1) % total)
          }}
          className="absolute top-1/2 right-3 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
        >
          <ChevronRight size={22} />
        </button>
      )}
      <figure
        className="flex max-h-[90vh] max-w-[min(100vw-2rem,72rem)] flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photoLabel(index, total)}
          className="max-h-[min(80vh,48rem)] w-auto max-w-full object-contain"
        />
        <figcaption className="text-sm text-white/80">
          {index + 1} / {total}
        </figcaption>
      </figure>
    </div>
  )
}
