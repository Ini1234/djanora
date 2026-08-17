'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Loader2, Check, Store, Calendar, Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { proxyClient } from '@/lib/proxy-client'
import { getErrorMessage } from '@/lib/errors'
import { VENDOR_CATEGORY_KEYS, getVendorCategoryLabel } from '@/lib/vendor-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'USER' | 'VENDOR'
type Tribe =
  | 'YORUBA'
  | 'IGBO'
  | 'HAUSA'
  | 'IBIBIO'
  | 'EFIK'
  | 'IJAW'
  | 'URHOBO'
  | 'BINI'
  | 'FULANI'
  | 'TIVI'
  | 'OTHER'

const USER_STEPS = 3 // Name → Role → About You
const VENDOR_STEPS = 5 // Name → Role → Business → Service → Pricing & Links

const EASE = [0.25, 0.46, 0.45, 0.94] as const

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0, filter: 'blur(4px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE } },
  exit: (dir: number) => ({
    x: dir > 0 ? -56 : 56,
    opacity: 0,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: EASE },
  }),
}

const TRIBES: { value: Tribe; label: string; flag: string }[] = [
  { value: 'YORUBA', label: 'Yoruba', flag: '🟢' },
  { value: 'IGBO', label: 'Igbo', flag: '🔵' },
  { value: 'HAUSA', label: 'Hausa', flag: '🟡' },
  { value: 'IBIBIO', label: 'Ibibio', flag: '🟠' },
  { value: 'EFIK', label: 'Efik', flag: '🔴' },
  { value: 'IJAW', label: 'Ijaw', flag: '🟣' },
  { value: 'URHOBO', label: 'Urhobo', flag: '🟤' },
  { value: 'BINI', label: 'Bini / Edo', flag: '⚪' },
  { value: 'FULANI', label: 'Fulani', flag: '🟡' },
  { value: 'TIVI', label: 'Tiv', flag: '🟢' },
  { value: 'OTHER', label: 'Other', flag: '🌍' },
]

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard({
  defaultFirstName = '',
  defaultLastName = '',
  nextPath = null,
}: {
  defaultFirstName?: string
  defaultLastName?: string
  nextPath?: string | null
}) {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // ── Shared fields ──
  const [firstName, setFirstName] = useState(defaultFirstName)
  const [lastName, setLastName] = useState(defaultLastName)
  const [role, setRole] = useState<Role | null>(null)

  // ── User-only fields (Step 3) ──
  const [tribes, setTribes] = useState<Tribe[]>([])
  const [city, setCity] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')

  // ── Vendor-only fields (Steps 3-5) ──
  const [businessName, setBusinessName] = useState('')
  const [vendorCategories, setVendorCategories] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [tribesServed, setTribesServed] = useState<string[]>([])
  const [vendorCity, setVendorCity] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const totalSteps = role === 'VENDOR' ? VENDOR_STEPS : USER_STEPS

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setError(null)
  }

  const canAdvance = (() => {
    if (step === 1) return firstName.trim().length >= 1
    if (step === 2) return role !== null
    if (role === 'USER') return true // step 3 optional
    // Vendor steps
    if (step === 3) return businessName.trim().length >= 2 && vendorCategories.length > 0
    return true // steps 4 & 5 optional
  })()

  const handleNext = async () => {
    if (step < totalSteps) {
      go(step + 1)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Always complete base onboarding first
      await proxyClient.patch('/users/me/onboarding', {
        firstName,
        lastName: lastName || undefined,
        role,
        ...(role === 'USER' && {
          tribes: tribes.length ? tribes : undefined,
          city: city.trim() || undefined,
          countryOfOrigin: countryOfOrigin.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
        }),
      })

      if (role === 'VENDOR') {
        await proxyClient.post('/vendors/profile', {
          businessName,
          category: vendorCategories[0],
          categories: vendorCategories,
          bio: bio.trim() || undefined,
          tribesServed: tribesServed.length ? tribesServed : undefined,
          city: vendorCity.trim() || undefined,
          estimatedPriceFrom: priceFrom ? parseInt(priceFrom, 10) : undefined,
          estimatedPriceTo: priceTo ? parseInt(priceTo, 10) : undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          instagramUrl: instagramUrl.trim() || undefined,
          facebookUrl: facebookUrl.trim() || undefined,
        })
      }

      if (nextPath) {
        router.push(nextPath)
      } else if (role === 'VENDOR') {
        router.push('/vendor/dashboard')
      } else {
        router.push('/')
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong.'))
    } finally {
      setLoading(false)
    }
  }

  const toggleTribe = (t: Tribe) => {
    setTribes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const toggleTribeServed = (t: string) => {
    setTribesServed((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const toggleVendorCategory = (v: string) => {
    setVendorCategories((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  }

  if (!mounted) return null

  return (
    <div className="bg-brand-900 relative flex min-h-screen flex-col overflow-hidden">
      <div className="pattern-adire absolute inset-0 opacity-5" aria-hidden="true" />
      <div
        className="bg-gold-600/10 pointer-events-none absolute -top-48 -right-48 h-[500px] w-[500px] rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="bg-brand-600/20 pointer-events-none absolute -bottom-48 -left-48 h-[500px] w-[500px] rounded-full blur-3xl"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/8 px-6 py-5">
        <span className="font-display text-lg font-semibold text-white">Djanora</span>

        {/* Role badge + progress */}
        <div className="flex items-center gap-3">
          {role === 'VENDOR' && step > 2 && (
            <span className="bg-gold-500/12 border-gold-500/25 text-gold-400 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
              <Store size={10} />
              Vendor setup
            </span>
          )}
          <div
            className="flex items-center gap-1.5"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
          >
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
              <motion.span
                key={i}
                animate={{
                  width: i === step ? 28 : 6,
                  backgroundColor:
                    i < step ? '#c9973a' : i === step ? '#e2bf6a' : 'rgba(255,255,255,0.18)',
                }}
                transition={{ duration: 0.3 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        </div>

        <span className="text-brand-500 text-sm">
          {step} / {totalSteps}
        </span>
      </header>

      {/* Step content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* ── Shared steps ── */}
              {step === 1 && (
                <StepName
                  firstName={firstName}
                  lastName={lastName}
                  onFirstName={setFirstName}
                  onLastName={setLastName}
                />
              )}
              {step === 2 && <StepRole value={role} onChange={setRole} />}

              {/* ── USER path ── */}
              {role !== 'VENDOR' && step === 3 && (
                <StepAbout
                  tribes={tribes}
                  city={city}
                  countryOfOrigin={countryOfOrigin}
                  dateOfBirth={dateOfBirth}
                  onToggleTribe={toggleTribe}
                  onCity={setCity}
                  onCountryOfOrigin={setCountryOfOrigin}
                  onDateOfBirth={setDateOfBirth}
                />
              )}

              {/* ── VENDOR path ── */}
              {role === 'VENDOR' && step === 3 && (
                <StepVendorBusiness
                  businessName={businessName}
                  categories={vendorCategories}
                  onBusinessName={setBusinessName}
                  onToggleCategory={toggleVendorCategory}
                />
              )}
              {role === 'VENDOR' && step === 4 && (
                <StepVendorService
                  bio={bio}
                  tribesServed={tribesServed}
                  city={vendorCity}
                  onBio={setBio}
                  onToggleTribe={toggleTribeServed}
                  onCity={setVendorCity}
                />
              )}
              {role === 'VENDOR' && step === 5 && (
                <StepVendorPricing
                  priceFrom={priceFrom}
                  priceTo={priceTo}
                  websiteUrl={websiteUrl}
                  instagramUrl={instagramUrl}
                  facebookUrl={facebookUrl}
                  onPriceFrom={setPriceFrom}
                  onPriceTo={setPriceTo}
                  onWebsite={setWebsiteUrl}
                  onInstagram={setInstagramUrl}
                  onFacebook={setFacebookUrl}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
              className="mt-6 rounded-xl border border-red-500/30 bg-red-900/30 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}

          {/* Nav */}
          <div className="mt-12 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(step - 1)}
              disabled={step === 1}
              className="text-brand-400 flex items-center gap-1.5 text-sm font-medium transition-all hover:text-white disabled:opacity-0"
            >
              <ChevronLeft size={16} />
              Back
            </button>

            <motion.button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance || loading}
              whileHover={canAdvance && !loading ? { scale: 1.02 } : {}}
              whileTap={canAdvance && !loading ? { scale: 0.98 } : {}}
              className="bg-gold-600 hover:bg-gold-500 text-brand-900 flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {step === totalSteps
                ? role === 'VENDOR'
                  ? 'Create my profile'
                  : "Let's go"
                : 'Continue'}
              {!loading && step < totalSteps && <ChevronRight size={16} />}
            </motion.button>
          </div>

          {step === totalSteps && (
            <p className="text-brand-500 mt-4 text-center text-xs">
              {role === 'VENDOR'
                ? 'You can update your profile any time from your vendor dashboard.'
                : 'Step 3 is optional — update anytime in your profile.'}
            </p>
          )}
        </div>
      </main>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Step 1: Name ─────────────────────────────────────────────────────────────

function StepName({
  firstName,
  lastName,
  onFirstName,
  onLastName,
}: {
  firstName: string
  lastName: string
  onFirstName: (v: string) => void
  onLastName: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">Welcome</p>
        <h1 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          Let&apos;s set up
          <br />
          your account
        </h1>
        <p className="text-brand-300 text-base leading-relaxed">
          Confirm how you&apos;d like to be known on Djanora.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label htmlFor="firstName" className="text-brand-200 mb-2 block text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoFocus
            autoComplete="given-name"
            placeholder="Ada"
            value={firstName}
            onChange={(e) => onFirstName(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-base text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="text-brand-200 mb-2 block text-sm font-medium">
            Last name <span className="text-brand-500 font-normal">(optional)</span>
          </label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Okafor"
            value={lastName}
            onChange={(e) => onLastName(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-base text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Role ─────────────────────────────────────────────────────────────

function StepRole({ value, onChange }: { value: Role | null; onChange: (v: Role) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">
          Your role
        </p>
        <h2 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          How are you
          <br />
          using Djanora?
        </h2>
        <p className="text-brand-300 text-base leading-relaxed">
          Choose your primary role — this shapes your entire experience.
        </p>
      </div>
      <div className="space-y-3">
        {(
          [
            {
              value: 'USER' as Role,
              emoji: '💑',
              label: 'Planning an event',
              desc: 'Browse vendors, build your guest list, manage your budget and checklist.',
            },
            {
              value: 'VENDOR' as Role,
              emoji: '🎪',
              label: 'I offer a service',
              desc: "Create a vendor profile and get discovered by planners. You'll set up your business details next.",
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              'relative flex w-full items-center gap-5 rounded-2xl border px-5 py-5 text-left transition-all duration-200',
              value === opt.value
                ? 'border-gold-500/80 bg-white/10 shadow-lg shadow-black/20'
                : 'border-white/10 bg-white/5 hover:border-white/22 hover:bg-white/8',
            )}
          >
            <span className="shrink-0 text-4xl">{opt.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-lg font-semibold text-white">{opt.label}</p>
              <p className="text-brand-300 text-sm leading-relaxed">{opt.desc}</p>
            </div>
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                value === opt.value ? 'border-gold-500 bg-gold-500' : 'border-white/20',
              )}
            >
              {value === opt.value && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                  <Check size={12} className="text-brand-900" />
                </motion.span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step 3 (User): About You ─────────────────────────────────────────────────

function StepAbout({
  tribes,
  city,
  countryOfOrigin,
  dateOfBirth,
  onToggleTribe,
  onCity,
  onCountryOfOrigin,
  onDateOfBirth,
}: {
  tribes: Tribe[]
  city: string
  countryOfOrigin: string
  dateOfBirth: string
  onToggleTribe: (v: Tribe) => void
  onCity: (v: string) => void
  onCountryOfOrigin: (v: string) => void
  onDateOfBirth: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">
          About you
        </p>
        <h2 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          Tell us a little
          <br />
          about yourself
        </h2>
        <p className="text-brand-300 text-base leading-relaxed">
          All optional — helps us personalise your experience.
        </p>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-brand-200 text-sm font-medium">
            Cultural background
            <span className="text-brand-500 ml-1 font-normal">(select all that apply)</span>
          </p>
          {tribes.length > 0 && (
            <span className="bg-gold-500/15 border-gold-500/30 text-gold-400 rounded-full border px-2 py-0.5 text-xs">
              {tribes.length} selected
            </span>
          )}
        </div>
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
          {TRIBES.map((t) => {
            const active = tribes.includes(t.value)
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => onToggleTribe(t.value)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200',
                  active
                    ? 'border-gold-500/80 bg-white/10'
                    : 'border-white/10 bg-white/5 hover:border-white/22 hover:bg-white/8',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                    active ? 'border-gold-500 bg-gold-500' : 'border-white/20 bg-transparent',
                  )}
                >
                  {active && <Check size={9} className="text-brand-900" />}
                </span>
                <span className="text-xl">{t.flag}</span>
                <span
                  className={cn('text-sm font-medium', active ? 'text-white' : 'text-brand-200')}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="city" className="text-brand-200 mb-2 block text-sm font-medium">
            City
          </label>
          <input
            id="city"
            type="text"
            autoComplete="address-level2"
            placeholder="Ottawa"
            value={city}
            onChange={(e) => onCity(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="countryOfOrigin"
            className="text-brand-200 mb-2 block text-sm font-medium"
          >
            Country of origin
          </label>
          <input
            id="countryOfOrigin"
            type="text"
            autoComplete="country-name"
            placeholder="Nigeria"
            value={countryOfOrigin}
            onChange={(e) => onCountryOfOrigin(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="dateOfBirth" className="text-brand-200 mb-2 block text-sm font-medium">
          Date of birth
        </label>
        <input
          id="dateOfBirth"
          type="date"
          autoComplete="bday"
          max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          value={dateOfBirth}
          onChange={(e) => onDateOfBirth(e.target.value)}
          className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white [color-scheme:dark] transition focus:bg-white/12 focus:outline-none"
        />
        <p className="text-brand-500 mt-1.5 text-xs">
          You must be 18+ to book or contract vendors on Djanora.
        </p>
      </div>
    </div>
  )
}

// ─── Step 3 (Vendor): Business Info ───────────────────────────────────────────

function StepVendorBusiness({
  businessName,
  categories,
  onBusinessName,
  onToggleCategory,
}: {
  businessName: string
  categories: string[]
  onBusinessName: (v: string) => void
  onToggleCategory: (v: string) => void
}) {
  const tCat = useTranslations('vendorCategories')
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">
          Your business
        </p>
        <h2 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          Tell us about
          <br />
          your business
        </h2>
        <p className="text-brand-300 text-base leading-relaxed">
          This is how planners will find and recognise you on Djanora.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="businessName" className="text-brand-200 mb-2 block text-sm font-medium">
            Business name
          </label>
          <input
            id="businessName"
            type="text"
            autoFocus
            placeholder="e.g. Mama Nkechi Catering"
            value={businessName}
            onChange={(e) => onBusinessName(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-base text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="text-brand-200 text-sm font-medium">
              Services offered
              <span className="text-brand-500 ml-1 font-normal">(select all that apply)</span>
            </label>
            {categories.length > 0 && (
              <span className="bg-gold-500/15 border-gold-500/30 text-gold-400 rounded-full border px-2 py-0.5 text-xs">
                {categories.length} selected
              </span>
            )}
          </div>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {VENDOR_CATEGORY_KEYS.map((key) => {
              const active = categories.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleCategory(key)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200',
                    active
                      ? 'border-gold-500/80 bg-white/10 text-white'
                      : 'text-brand-200 border-white/10 bg-white/5 hover:border-white/22 hover:bg-white/8',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors',
                      active ? 'border-gold-500 bg-gold-500' : 'border-white/20 bg-transparent',
                    )}
                  >
                    {active && <Check size={9} className="text-brand-900" />}
                  </span>
                  {getVendorCategoryLabel(key, tCat)}
                </button>
              )
            })}
          </div>
          {categories.length === 0 && (
            <p className="text-brand-500 mt-2 text-xs">Pick at least one to continue.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4 (Vendor): Service Description ─────────────────────────────────────

function StepVendorService({
  bio,
  tribesServed,
  city,
  onBio,
  onToggleTribe,
  onCity,
}: {
  bio: string
  tribesServed: string[]
  city: string
  onBio: (v: string) => void
  onToggleTribe: (t: string) => void
  onCity: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">
          Your service
        </p>
        <h2 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          Describe your
          <br />
          service
        </h2>
        <p className="text-brand-300 text-base leading-relaxed">
          All optional — you can update this anytime.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label htmlFor="bio" className="text-brand-200 mb-2 block text-sm font-medium">
            Bio <span className="text-brand-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="bio"
            rows={3}
            placeholder="Tell planners what makes your service special…"
            value={bio}
            onChange={(e) => onBio(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full resize-none rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-brand-200 mb-3 block text-sm font-medium">
            Communities you serve{' '}
            <span className="text-brand-500 font-normal">(optional — select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TRIBES.map((t) => {
              const active = tribesServed.includes(t.value)
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onToggleTribe(t.value)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200',
                    active
                      ? 'border-gold-500/80 bg-white/10 text-white'
                      : 'text-brand-200 border-white/10 bg-white/5 hover:border-white/22 hover:bg-white/8',
                  )}
                >
                  <span className="text-lg">{t.flag}</span>
                  {t.label}
                  {active && <Check size={13} className="text-gold-400 ml-auto shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="vendorCity" className="text-brand-200 mb-2 block text-sm font-medium">
            <Globe size={13} className="text-brand-400 mr-1.5 inline" />
            City / region <span className="text-brand-500 font-normal">(optional)</span>
          </label>
          <input
            id="vendorCity"
            type="text"
            placeholder="e.g. Ottawa, ON"
            value={city}
            onChange={(e) => onCity(e.target.value)}
            className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3.5 text-sm text-white transition focus:bg-white/12 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 5 (Vendor): Pricing & Links ─────────────────────────────────────────

function StepVendorPricing({
  priceFrom,
  priceTo,
  websiteUrl,
  instagramUrl,
  facebookUrl,
  onPriceFrom,
  onPriceTo,
  onWebsite,
  onInstagram,
  onFacebook,
}: {
  priceFrom: string
  priceTo: string
  websiteUrl: string
  instagramUrl: string
  facebookUrl: string
  onPriceFrom: (v: string) => void
  onPriceTo: (v: string) => void
  onWebsite: (v: string) => void
  onInstagram: (v: string) => void
  onFacebook: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-gold-400 mb-3 text-sm font-medium tracking-widest uppercase">
          Pricing & links
        </p>
        <h2 className="font-display mb-3 text-4xl leading-tight font-semibold text-white sm:text-5xl">
          Help planners
          <br />
          plan their budget
        </h2>
        <p className="text-brand-300 text-base leading-relaxed">
          All optional — gives planners an idea of what to expect.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-brand-200 mb-3 block text-sm font-medium">
            <Calendar size={13} className="text-brand-400 mr-1.5 inline" />
            Estimated price range (CA$)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="priceFrom" className="text-brand-400 mb-1.5 block text-xs">
                From
              </label>
              <input
                id="priceFrom"
                type="number"
                min={0}
                placeholder="500"
                value={priceFrom}
                onChange={(e) => onPriceFrom(e.target.value)}
                className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white transition focus:bg-white/12 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="priceTo" className="text-brand-400 mb-1.5 block text-xs">
                To
              </label>
              <input
                id="priceTo"
                type="number"
                min={0}
                placeholder="2000"
                value={priceTo}
                onChange={(e) => onPriceTo(e.target.value)}
                className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white transition focus:bg-white/12 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-brand-200 text-sm font-medium">
            Links <span className="text-brand-500 font-normal">(optional)</span>
          </p>
          {[
            {
              id: 'website',
              label: 'Website',
              placeholder: 'https://yoursite.com',
              value: websiteUrl,
              onChange: onWebsite,
            },
            {
              id: 'instagram',
              label: 'Instagram',
              placeholder: 'https://instagram.com/yourpage',
              value: instagramUrl,
              onChange: onInstagram,
            },
            {
              id: 'facebook',
              label: 'Facebook',
              placeholder: 'https://facebook.com/yourpage',
              value: facebookUrl,
              onChange: onFacebook,
            },
          ].map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="text-brand-400 mb-1.5 block text-xs">
                {field.label}
              </label>
              <input
                id={field.id}
                type="url"
                placeholder={field.placeholder}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="placeholder:text-brand-500 focus:border-gold-500/60 w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white transition focus:bg-white/12 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
