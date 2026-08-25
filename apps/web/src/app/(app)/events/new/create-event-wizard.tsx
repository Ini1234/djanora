'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Users,
  Calendar,
  MapPin,
  DollarSign,
  Sparkles,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { getVendorCategoryLabel } from '@/lib/vendor-categories'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6

const EVENT_TYPES = [
  {
    value: 'WEDDING',
    label: 'Wedding',
    description:
      'The whole celebration — add traditional, court, reception as sub-events if you need them',
  },
  {
    value: 'TRADITIONAL_WEDDING',
    label: 'Traditional Wedding',
    description: 'A cultural ceremony honouring family traditions',
  },
  {
    value: 'WHITE_WEDDING',
    label: 'White Wedding',
    description: 'Church wedding in Western style',
  },
  { value: 'COURT', label: 'Court', description: 'Legal ceremony at the registry' },
  { value: 'BRIDE_PRICE', label: 'Bride price', description: 'Family negotiation and gifts' },
  {
    value: 'RECEPTION',
    label: 'Wedding Reception',
    description: 'The grand celebration after the ceremony',
  },
  {
    value: 'INTRODUCTION',
    label: 'Introduction',
    description: 'Families meet and gifts are presented',
  },
  {
    value: 'ENGAGEMENT',
    label: 'Engagement Party',
    description: 'Celebrating the couple before the big day',
  },
  {
    value: 'CUSTOM',
    label: 'Custom ceremony',
    description: 'A named cultural rite — you choose the title',
  },
  {
    value: 'NAMING_CEREMONY',
    label: 'Naming Ceremony',
    description: 'Welcoming a new child into the family',
  },
] as const

const TRIBES = [
  {
    value: 'IBIBIO',
    label: 'Ibibio',
    region: 'Akwa Ibom',
    description: 'Ukod inyanga attire, nkuho ceremony, coral beads & ofong fabric',
  },
  {
    value: 'YORUBA',
    label: 'Yoruba',
    region: 'Southwest Nigeria',
    description: 'Gele, aso-oke, alaga ceremony & palm wine carrying',
  },
  {
    value: 'IGBO',
    label: 'Igbo',
    region: 'Southeast Nigeria',
    description: 'George wrapper, oji (kola nut) & wine-carrying ceremony',
  },
  {
    value: 'EFIK',
    label: 'Efik',
    region: 'Cross River',
    description: 'Mbuoñ wrapper, coral beads, mbopo ceremony & nkwa music',
  },
  {
    value: 'IJAW',
    label: 'Ijaw',
    region: 'Niger Delta',
    description: 'Traditional wrapper, perebo dowry ceremony & ekine masquerade',
  },
  {
    value: 'HAUSA',
    label: 'Hausa',
    region: 'Northern Nigeria',
    description: 'Atamfa fabric, lefe gift exchange & lalle (henna) night',
  },
  {
    value: 'URHOBO',
    label: 'Urhobo',
    region: 'Delta State',
    description: 'Ufuoma attire, ighele bride price negotiation & cultural dance',
  },
  {
    value: 'BINI',
    label: 'Bini / Edo',
    region: 'Edo State',
    description: 'Coral beads, isi marriage rites & Bini royal music',
  },
  {
    value: 'FULANI',
    label: 'Fulani',
    region: 'Multiple states',
    description: 'Shadi wedding, wurooji gifts, woven fabric & griot performers',
  },
  {
    value: 'TIVI',
    label: 'Tiv',
    region: 'Benue State',
    description: 'Handwoven gende cloth, swange dance & kuchichun bride price',
  },
  {
    value: 'OTHER',
    label: 'Other / Mixed',
    region: 'Diaspora blend',
    description: 'Multiple cultures, mixed heritage, or a custom blend',
  },
] as const

const THEMES = [
  {
    value: 'TRADITIONAL',
    label: 'Full Traditional',
    description: 'Rich cultural colours, native fabrics, indigenous decor',
    palette: ['#8B4513', '#DAA520', '#006400'],
  },
  {
    value: 'FUSION',
    label: 'Afro-Fusion',
    description: 'Modern elegance meets Nigerian cultural elements',
    palette: ['#1B4332', '#D4AF37', '#F5E6C8'],
  },
  {
    value: 'REGAL',
    label: 'Regal',
    description: 'Deep burgundy, gold, and royal formality',
    palette: ['#4A0E1A', '#C9A84C', '#1A0A0C'],
  },
  {
    value: 'WHITE_WEDDING',
    label: 'Classic White',
    description: 'Timeless white and ivory with soft floral arrangements',
    palette: ['#F9F9F9', '#E8C8A0', '#B0A090'],
  },
  {
    value: 'INDOOR_LUXURY',
    label: 'Indoor Luxury',
    description: 'Ballroom glamour with chandelier lighting and draped ceilings',
    palette: ['#1A1A2E', '#C9A84C', '#FFFFFF'],
  },
  {
    value: 'BLACK_TIE',
    label: 'Black tie',
    description: 'Evening formal — black, navy, and champagne',
    palette: ['#0B0B0F', '#1B2A4A', '#E8D5B5'],
  },
  {
    value: 'MODERN',
    label: 'Modern',
    description: 'Clean lines, restrained palette, contemporary venue',
    palette: ['#2C2C2C', '#C4C4C4', '#F4F1EA'],
  },
  {
    value: 'INTIMATE',
    label: 'Intimate',
    description: 'Small gathering — warm light, close tables, quiet luxury',
    palette: ['#3D2A1F', '#D4A574', '#F3E6D8'],
  },
  {
    value: 'OUTDOOR',
    label: 'Outdoor Garden',
    description: 'Open-air celebration under the sky with floral arches',
    palette: ['#2D6A4F', '#F0C040', '#FFFFFF'],
  },
  {
    value: 'GARDEN',
    label: 'Botanical Garden',
    description: 'Lush greenery, wildflowers, and organic natural textures',
    palette: ['#3A7D44', '#A8D5A2', '#F5F5DC'],
  },
] as const

const DEFAULT_BUDGET_SPLIT: Record<string, number> = {
  CATERER: 0.3,
  PHOTOGRAPHER: 0.12,
  VIDEOGRAPHER: 0.08,
  DECORATOR: 0.15,
  DJ: 0.08,
  MAKEUP_ARTIST: 0.07,
  MC: 0.05,
  WEDDING_PLANNER: 0.05,
  FASHION_STYLIST: 0.05,
  LIVE_BAND: 0.03,
  OTHER: 0.02,
}

// ─── Shared components ────────────────────────────────────────────────────────

/** Compact horizontal pill for event type */
function EventTypePill({
  selected,
  label,
  onClick,
}: {
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all',
        selected
          ? 'bg-gold-500/15 border-gold-500 text-gold-300 ring-gold-500/20 ring-1'
          : 'text-brand-300 border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8 hover:text-white',
      )}
    >
      {selected && <Check size={12} strokeWidth={3} className="text-gold-400 shrink-0" />}
      {label}
    </button>
  )
}

/** Compact checkbox row for tribe list */
function TribeRow({
  selected,
  label,
  region,
  description,
  onClick,
}: {
  selected: boolean
  label: string
  region: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition-all',
        selected
          ? 'bg-gold-500/10 border-gold-500/50 ring-gold-500/20 ring-1'
          : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/6',
      )}
    >
      {/* Checkbox indicator */}
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
          selected ? 'border-gold-500 bg-gold-500' : 'border-brand-500',
        )}
      >
        {selected && <Check size={10} strokeWidth={3} className="text-brand-900" />}
      </span>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', selected ? 'text-gold-200' : 'text-white')}>
            {label}
          </span>
          <span className="text-brand-500 text-[10px] font-normal">{region}</span>
        </div>
        <p className="text-brand-400 mt-0.5 text-xs leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface WizardState {
  eventType: string
  tribes: string[]
  themes: string[]
  title: string
  estimatedDate: string
  guestCount: string
  location: string
  totalBudget: string
  includeDefaultBudget: boolean
  includeDefaultChecklist: boolean
}

const initialState: WizardState = {
  eventType: '',
  tribes: [],
  themes: [],
  title: '',
  estimatedDate: '',
  guestCount: '',
  location: 'Ottawa, Ontario, Canada',
  totalBudget: '',
  includeDefaultBudget: false,
  includeDefaultChecklist: false,
}

// ─── Variants ─────────────────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepProgress({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-all duration-300',
            i < step ? 'bg-gold-500' : i === step - 1 ? 'bg-gold-400' : 'bg-white/15',
          )}
        />
      ))}
    </div>
  )
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

function StepEventType({
  state,
  set,
}: {
  state: WizardState
  set: (k: keyof WizardState, v: string) => void
}) {
  const selected = EVENT_TYPES.find((t) => t.value === state.eventType)
  return (
    <div>
      <h2 className="font-display mb-1 text-2xl font-semibold text-white">
        What are we celebrating?
      </h2>
      <p className="text-brand-300 mb-6 text-sm">Choose the type of event you&apos;re planning.</p>

      {/* Pill grid */}
      <div className="mb-6 flex flex-wrap gap-2">
        {EVENT_TYPES.map(({ value, label }) => (
          <EventTypePill
            key={value}
            selected={state.eventType === value}
            label={label}
            onClick={() => set('eventType', value)}
          />
        ))}
      </div>

      {/* Description of selected */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="bg-gold-500/8 border-gold-500/20 rounded-xl border px-4 py-3"
          >
            <p className="text-gold-200 text-sm font-medium">{selected.label}</p>
            <p className="text-brand-300 mt-0.5 text-xs">{selected.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StepTribe({
  state,
  toggleTribe,
}: {
  state: WizardState
  toggleTribe: (v: string) => void
  set: (k: keyof WizardState, v: string) => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q
      ? TRIBES.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            t.region.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q),
        )
      : TRIBES
  }, [query])

  return (
    <div>
      <h2 className="font-display mb-1 text-2xl font-semibold text-white">Which cultures?</h2>
      <p className="text-brand-300 mb-1 text-sm">
        Select all that apply — we&apos;ll merge the traditions into one checklist.
      </p>
      {state.tribes.length > 0 && (
        <p className="text-gold-400 mb-3 text-xs">{state.tribes.length} selected</p>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="text-brand-500 absolute top-1/2 left-3.5 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cultures…"
          className="placeholder:text-brand-500 focus:ring-gold-500/40 focus:border-gold-500/40 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-4 pl-9 text-sm text-white transition-colors focus:ring-2 focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {filtered.map(({ value, label, region, description }) => (
          <TribeRow
            key={value}
            selected={state.tribes.includes(value)}
            label={label}
            region={region}
            description={description}
            onClick={() => toggleTribe(value)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-brand-400 py-6 text-center text-sm">
            No match — try &quot;Other / Mixed&quot;
          </p>
        )}
      </div>
    </div>
  )
}

function StepTheme({
  state,
  toggleTheme,
}: {
  state: WizardState
  toggleTheme: (value: string) => void
}) {
  const selected = THEMES.filter((t) => state.themes.includes(t.value))
  return (
    <div>
      <h2 className="font-display mb-1 text-2xl font-semibold text-white">Set the scene</h2>
      <p className="text-brand-300 mb-6 text-sm">
        Pick one or more looks. They apply to this event and any sub-events you add later.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {THEMES.map(({ value, label }) => (
          <EventTypePill
            key={value}
            selected={state.themes.includes(value)}
            label={label}
            onClick={() => toggleTheme(value)}
          />
        ))}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((theme) => (
            <div
              key={theme.value}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="mb-2.5 flex gap-1">
                {theme.palette.map((c) => (
                  <div key={c} className="h-3 flex-1 rounded-md" style={{ background: c }} />
                ))}
              </div>
              <p className="text-sm font-medium text-white">{theme.label}</p>
              <p className="text-brand-300 mt-0.5 text-xs">{theme.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepDetails({
  state,
  set,
}: {
  state: WizardState
  set: (k: keyof WizardState, v: string) => void
}) {
  const selectedType = EVENT_TYPES.find((t) => t.value === state.eventType)
  const placeholder = selectedType ? `My ${selectedType.label}` : 'Event name'

  return (
    <div>
      <h2 className="font-display mb-1 text-2xl font-semibold text-white">Event details</h2>
      <p className="text-brand-300 mb-6 text-sm">
        Add the specifics — everything here is optional except the name.
      </p>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="text-brand-200 mb-1.5 block text-sm font-medium">
            Event name <span className="text-gold-500">*</span>
          </label>
          <input
            type="text"
            value={state.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={placeholder}
            className="placeholder:text-brand-500 focus:ring-gold-500/50 focus:border-gold-500/50 w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white transition-colors focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-brand-200 mb-1.5 block text-sm font-medium">
            <Calendar size={13} className="text-brand-400 mr-1.5 inline" />
            Estimated date <span className="text-brand-500">(optional)</span>
          </label>
          <input
            type="date"
            value={state.estimatedDate}
            onChange={(e) => set('estimatedDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="focus:ring-gold-500/50 focus:border-gold-500/50 w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white [color-scheme:dark] transition-colors focus:ring-2 focus:outline-none"
          />
        </div>

        {/* Guest count + Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-brand-200 mb-1.5 block text-sm font-medium">
              <Users size={13} className="text-brand-400 mr-1.5 inline" />
              Guests <span className="text-brand-500">(optional)</span>
            </label>
            <input
              type="number"
              value={state.guestCount}
              onChange={(e) => set('guestCount', e.target.value)}
              placeholder="200"
              min={1}
              max={5000}
              className="placeholder:text-brand-500 focus:ring-gold-500/50 focus:border-gold-500/50 w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white transition-colors focus:ring-2 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-brand-200 mb-1.5 block text-sm font-medium">
              <MapPin size={13} className="text-brand-400 mr-1.5 inline" />
              Location
            </label>
            <input
              type="text"
              value={state.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Ottawa, Ontario, Canada"
              className="placeholder:text-brand-500 focus:ring-gold-500/50 focus:border-gold-500/50 w-full rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-sm text-white transition-colors focus:ring-2 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function StepBudget({
  state,
  set,
  toggleSeed,
}: {
  state: WizardState
  set: (k: keyof WizardState, v: string) => void
  toggleSeed: (k: 'includeDefaultBudget' | 'includeDefaultChecklist') => void
}) {
  const tCat = useTranslations('vendorCategories')
  const raw = parseInt(state.totalBudget, 10)
  const budget = Number.isFinite(raw) && raw >= 0 ? raw : 0
  const formatted = Number.isFinite(raw) && raw >= 0 ? raw.toLocaleString('en-CA') : ''

  const topCategories = Object.entries(DEFAULT_BUDGET_SPLIT)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div>
      <h2 className="font-display mb-1 text-2xl font-semibold text-white">Your budget</h2>
      <p className="text-brand-300 mb-6 text-sm">
        Set your total budget in CAD. You can start with a starter split and checklist, or build
        both from scratch.
      </p>

      {/* Budget input */}
      <div className="mb-6">
        <label className="text-brand-200 mb-1.5 block text-sm font-medium">
          <DollarSign size={13} className="text-brand-400 mr-1 inline" />
          Total budget (CAD) <span className="text-gold-500">*</span>
        </label>
        <div className="relative">
          <span className="text-brand-400 absolute top-1/2 left-4 -translate-y-1/2 text-sm font-medium">
            CA$
          </span>
          <input
            type="number"
            value={state.totalBudget}
            onChange={(e) => set('totalBudget', e.target.value)}
            placeholder="0"
            min={0}
            className="placeholder:text-brand-500 focus:ring-gold-500/50 focus:border-gold-500/50 w-full rounded-xl border border-white/12 bg-white/6 py-3.5 pr-4 pl-12 text-lg font-semibold text-white transition-colors focus:ring-2 focus:outline-none"
          />
        </div>
        <p className="text-brand-500 mt-1.5 text-xs">
          Any amount, including CA$0 if you&apos;re still deciding.
        </p>
      </div>

      <div className="mb-6 space-y-2">
        <button
          type="button"
          onClick={() => toggleSeed('includeDefaultBudget')}
          className={cn(
            'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
            state.includeDefaultBudget
              ? 'border-gold-500/50 bg-gold-500/10'
              : 'border-white/10 bg-white/4 hover:border-white/20',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
              state.includeDefaultBudget ? 'border-gold-500 bg-gold-500' : 'border-brand-500',
            )}
          >
            {state.includeDefaultBudget && (
              <Check size={10} strokeWidth={3} className="text-brand-900" />
            )}
          </span>
          <span>
            <span className="block text-sm font-medium text-white">Starter budget categories</span>
            <span className="text-brand-400 mt-0.5 block text-xs">
              Split this total across catering, photo, décor, and the rest. You can edit every line
              later.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => toggleSeed('includeDefaultChecklist')}
          className={cn(
            'flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all',
            state.includeDefaultChecklist
              ? 'border-gold-500/50 bg-gold-500/10'
              : 'border-white/10 bg-white/4 hover:border-white/20',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2',
              state.includeDefaultChecklist ? 'border-gold-500 bg-gold-500' : 'border-brand-500',
            )}
          >
            {state.includeDefaultChecklist && (
              <Check size={10} strokeWidth={3} className="text-brand-900" />
            )}
          </span>
          <span>
            <span className="block text-sm font-medium text-white">Starter checklist</span>
            <span className="text-brand-400 mt-0.5 block text-xs">
              Venue, vendors, invitations, plus cultural tasks from the traditions you picked.
            </span>
          </span>
        </button>
      </div>

      {/* Budget preview */}
      {state.includeDefaultBudget && budget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/4 p-4"
        >
          <p className="text-brand-300 mb-3 text-xs font-medium tracking-wider uppercase">
            Budget split preview
          </p>
          <div className="space-y-2">
            {topCategories.map(([category, ratio]) => {
              const amount = Math.round(budget * ratio)
              const width = Math.round(ratio * 100)
              return (
                <div key={category}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-brand-300">{getVendorCategoryLabel(category, tCat)}</span>
                    <span className="font-medium text-white">
                      CA${amount.toLocaleString('en-CA')}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                      className="from-gold-500 to-gold-400 h-full rounded-full bg-gradient-to-r"
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-brand-500 pt-1 text-right text-xs">+ 6 more categories</p>
          </div>
          <div className="mt-3 flex justify-between border-t border-white/8 pt-3">
            <span className="text-brand-300 text-sm">Total</span>
            <span className="text-gold-400 text-sm font-semibold">CA${formatted}</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function StepReview({ state }: { state: WizardState }) {
  const eventLabel = EVENT_TYPES.find((t) => t.value === state.eventType)?.label ?? state.eventType
  const tribeLabels = state.tribes
    .map((v) => TRIBES.find((t) => t.value === v)?.label ?? v)
    .join(', ')
  const themeLabel = state.themes
    .map((v) => THEMES.find((t) => t.value === v)?.label ?? v)
    .join(', ')
  const budget = parseInt(state.totalBudget, 10) || 0

  const rows = [
    { label: 'Event', value: eventLabel },
    { label: 'Culture', value: tribeLabels },
    { label: 'Theme', value: themeLabel },
    { label: 'Name', value: state.title },
    {
      label: 'Date',
      value: state.estimatedDate
        ? new Date(state.estimatedDate).toLocaleDateString('en-CA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'TBD',
    },
    {
      label: 'Guests',
      value: state.guestCount ? `${parseInt(state.guestCount).toLocaleString()} guests` : 'TBD',
    },
    { label: 'Location', value: state.location || 'Ottawa, Ontario, Canada' },
    { label: 'Budget', value: `CA$${budget.toLocaleString('en-CA')}` },
    {
      label: 'Starters',
      value:
        [
          state.includeDefaultBudget ? 'Budget categories' : null,
          state.includeDefaultChecklist ? 'Checklist' : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'None — start blank',
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-gold-500/15 rounded-xl p-2.5">
          <Sparkles size={18} className="text-gold-400" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-white">Review & create</h2>
          <p className="text-brand-300 text-sm">
            {state.includeDefaultChecklist || state.includeDefaultBudget
              ? 'We’ll add the starters you chose. You can edit every line after this.'
              : 'We’ll create a blank event. Add budget lines and tasks whenever you’re ready.'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/4">
        {rows.map(({ label, value }, i) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between px-4 py-3 text-sm',
              i < rows.length - 1 && 'border-b border-white/6',
            )}
          >
            <span className="text-brand-400 w-20 shrink-0">{label}</span>
            <span className="text-right text-white">{value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
        <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-emerald-300">
          {state.includeDefaultChecklist && state.includeDefaultBudget
            ? 'We’ll create a personalised checklist with cultural traditions and auto-split your budget across vendor categories.'
            : state.includeDefaultChecklist
              ? 'We’ll create a personalised checklist with cultural traditions. Budget categories stay empty until you add them.'
              : state.includeDefaultBudget
                ? 'We’ll split your budget across vendor categories. The checklist starts empty.'
                : 'Your event starts blank — add budget lines and checklist tasks from the event page.'}
        </p>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function CreateEventWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [state, setState] = useState<WizardState>(initialState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = useCallback((key: keyof WizardState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleSeed = useCallback((key: 'includeDefaultBudget' | 'includeDefaultChecklist') => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const toggleTribe = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      tribes: prev.tribes.includes(value)
        ? prev.tribes.filter((t) => t !== value)
        : [...prev.tribes, value],
    }))
  }, [])

  const toggleTheme = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      themes: prev.themes.includes(value)
        ? prev.themes.filter((t) => t !== value)
        : [...prev.themes, value],
    }))
  }, [])

  const canAdvance = (() => {
    switch (step) {
      case 1:
        return !!state.eventType
      case 2:
        return state.tribes.length > 0
      case 3:
        return state.themes.length > 0
      case 4:
        return state.title.trim().length >= 2
      case 5: {
        const amount = parseInt(state.totalBudget, 10)
        return Number.isFinite(amount) && amount >= 0
      }
      default:
        return true
    }
  })()

  const go = (delta: number) => {
    setDir(delta)
    setStep((s) => s + delta)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: event } = await proxyClient.post<{ id: string }>('/events', {
        title: state.title,
        eventType: state.eventType,
        tribes: state.tribes,
        themes: state.themes,
        totalBudget: parseInt(state.totalBudget, 10),
        includeDefaultBudget: state.includeDefaultBudget,
        includeDefaultChecklist: state.includeDefaultChecklist,
        estimatedDate: state.estimatedDate || undefined,
        guestCount: state.guestCount ? parseInt(state.guestCount, 10) : undefined,
        location: state.location || undefined,
      })
      router.push(`/events/${event.id}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong'))
      setLoading(false)
    }
  }

  const stepProps = { state, set, toggleTribe, toggleTheme }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-start justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/events')}
            className="text-brand-400 mb-6 flex items-center gap-1.5 text-sm transition-colors hover:text-white"
          >
            <ChevronLeft size={16} /> Back to Events
          </button>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-brand-400 text-xs font-medium tracking-widest uppercase">
              Step {step} of {TOTAL_STEPS}
            </p>
          </div>
          <StepProgress step={step} />
        </div>

        {/* Step panel */}
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-6 md:p-8">
          {/* Adire pattern */}
          <div className="pattern-adire pointer-events-none absolute inset-0 opacity-[0.03]" />

          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="relative z-10"
            >
              {step === 1 && <StepEventType {...stepProps} />}
              {step === 2 && <StepTribe {...stepProps} toggleTribe={toggleTribe} />}
              {step === 3 && <StepTheme state={state} toggleTheme={toggleTheme} />}
              {step === 4 && <StepDetails {...stepProps} />}
              {step === 5 && <StepBudget {...stepProps} toggleSeed={toggleSeed} />}
              {step === 6 && <StepReview state={state} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={step === 1}
            className="text-brand-300 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => go(1)}
              disabled={!canAdvance}
              className="bg-gold-600 hover:bg-gold-500 text-brand-900 shadow-gold-900/20 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gold-600 hover:bg-gold-500 text-brand-900 shadow-gold-900/20 flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-lg transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Create Event
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
