'use client'

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import type {
  EventSiteNavAlign,
  EventSiteNavBorder,
  EventSiteNavBorderStyle,
  EventSiteNavBorderWidth,
  EventSiteNavStyle,
  EventSiteSectionType,
  PublicEventSite,
} from '@/lib/api.types'

export function navStyleOf(raw?: string | null): EventSiteNavStyle {
  return raw === 'pill' || raw === 'underline' || raw === 'solid' ? raw : 'line'
}

export function navAlignOf(raw?: string | null): EventSiteNavAlign {
  if (raw === 'before' || raw === 'start') return 'before'
  if (raw === 'below') return 'below'
  return 'above'
}

export function navBorderOf(raw?: string | null): EventSiteNavBorder {
  return raw === 'off' ? 'off' : 'on'
}

export function navBorderWidthOf(raw?: string | null): EventSiteNavBorderWidth {
  return raw === 'medium' || raw === 'thick' ? raw : 'thin'
}

export function navBorderStyleOf(raw?: string | null): EventSiteNavBorderStyle {
  return raw === 'dashed' || raw === 'dotted' ? raw : 'solid'
}

export function SiteNav({
  look,
  items,
  ownerTitle,
  compact,
}: {
  look: PublicEventSite['look']
  items: { key: string; anchor: string; label: string; type: EventSiteSectionType }[]
  ownerTitle: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const variant = look.navPlacement === 'side' ? 'side' : 'top'
  const style = navStyleOf(look.navStyle)
  const namePlace = navAlignOf(look.navAlign)
  const border = navBorderOf(look.navBorder)
  const borderWidth = navBorderWidthOf(look.navBorderWidth)
  const borderStyle = navBorderStyleOf(look.navBorderStyle)
  const sideDesktop = variant === 'side' && !compact
  const home = items.find((item) => item.type === 'COVER')
  const links = items.filter((item) => item.type !== 'COVER')
  const menuId = 'site-page-links'
  const displayName = look.navName?.trim() || ownerTitle || 'Event'

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function goTo(anchor: string, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setOpen(false)
    document.getElementById(anchor)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const brand = home ? (
    <a
      href={`#${home.anchor}`}
      onClick={(event) => goTo(home.anchor, event)}
      className="site-nav-brand min-w-0"
    >
      {displayName}
    </a>
  ) : (
    <p className="site-nav-brand min-w-0">{displayName}</p>
  )

  function renderLinks(stacked: boolean) {
    return (
      <div className={stacked ? 'site-nav-links site-nav-links-stack' : 'site-nav-links'}>
        {links.map((item, index) => (
          <span key={item.key} className="site-nav-item">
            {!stacked && index > 0 && (
              <span className="site-nav-dot" aria-hidden="true">
                ·
              </span>
            )}
            <a
              href={`#${item.anchor}`}
              onClick={(event) => goTo(item.anchor, event)}
              className={item.type === 'RSVP' ? 'site-nav-link site-nav-rsvp' : 'site-nav-link'}
            >
              {item.label}
            </a>
          </span>
        ))}
      </div>
    )
  }

  const menuButton = (
    <button
      type="button"
      className="tap-target site-nav-menu inline-flex items-center justify-center"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}
    >
      {open ? <X size={20} /> : <Menu size={20} />}
      <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
    </button>
  )

  const card: ReactNode =
    namePlace === 'before' ? (
      <div className="site-nav-card site-nav-card-row">
        {brand}
        {renderLinks(false)}
      </div>
    ) : namePlace === 'below' ? (
      <div className="site-nav-card">
        {renderLinks(false)}
        {links.length > 0 && <div className="site-nav-rule" aria-hidden="true" />}
        {brand}
      </div>
    ) : (
      <div className="site-nav-card">
        {brand}
        {links.length > 0 && <div className="site-nav-rule" aria-hidden="true" />}
        {renderLinks(false)}
      </div>
    )

  if (compact) {
    if (variant === 'side') {
      return (
        <header
          className="event-site-nav event-site-nav-side flex w-[7.5rem] shrink-0 flex-col px-2 py-4"
          data-style={style}
          data-align={namePlace}
          data-border="off"
        >
          <nav aria-label="On this page" className="flex flex-col items-center text-center">
            {namePlace !== 'below' && brand}
            {namePlace !== 'below' && <div className="site-nav-rule" aria-hidden="true" />}
            <div className="mt-2">{renderLinks(true)}</div>
            {namePlace === 'below' && <div className="site-nav-rule" aria-hidden="true" />}
            {namePlace === 'below' && brand}
          </nav>
        </header>
      )
    }
    return (
      <header
        className="event-site-nav px-3 py-4"
        data-style={style}
        data-align={namePlace}
        data-border={border}
        data-border-width={borderWidth}
        data-border-style={borderStyle}
      >
        <nav aria-label="On this page">{card}</nav>
      </header>
    )
  }

  const topBar = (
    <header
      className={
        sideDesktop
          ? 'event-site-nav sticky top-0 z-30 lg:hidden'
          : 'event-site-nav sticky top-0 z-30'
      }
      data-style={style}
      data-align={namePlace}
      data-border={border}
      data-border-width={borderWidth}
      data-border-style={borderStyle}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: '1rem',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <nav aria-label="On this page" className="mx-auto max-w-3xl">
        {sideDesktop ? (
          <>
            <div className="flex items-center justify-between gap-3">
              {brand}
              {menuButton}
            </div>
            {open && (
              <div id={menuId} className="mt-4">
                {renderLinks(true)}
              </div>
            )}
          </>
        ) : (
          card
        )}
      </nav>
    </header>
  )

  if (!sideDesktop) return topBar

  return (
    <>
      {topBar}
      <header
        className="event-site-nav event-site-nav-side hidden lg:flex"
        data-style={style}
        data-align={namePlace}
        data-border="off"
        style={{
          position: 'fixed',
          top: 'var(--sandbox-offset, 0px)',
          left: 0,
          bottom: 0,
          zIndex: 30,
          width: '12.5rem',
          padding: '2.5rem 1.25rem',
        }}
      >
        <nav aria-label="On this page" className="flex h-full flex-col items-center text-center">
          {namePlace !== 'below' && brand}
          {namePlace !== 'below' && <div className="site-nav-rule" aria-hidden="true" />}
          <div className="mt-2">{renderLinks(true)}</div>
          {namePlace === 'below' && <div className="site-nav-rule" aria-hidden="true" />}
          {namePlace === 'below' && brand}
        </nav>
      </header>
    </>
  )
}
