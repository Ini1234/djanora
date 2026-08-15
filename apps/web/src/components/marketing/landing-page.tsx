import Link from 'next/link'
import {
  Sparkles,
  MapPin,
  ChevronRight,
  Star,
  Users,
  CalendarDays,
  Wallet,
  Utensils,
  Music2,
  Camera,
  Mic2,
  Palette,
  Shirt,
  CheckCircle2,
} from 'lucide-react'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'

const vendorCategories = [
  { icon: Utensils, label: 'Catering', description: 'Menus for any celebration' },
  { icon: Music2, label: 'DJ & Music', description: 'Sets that fit the room' },
  { icon: Camera, label: 'Photography', description: 'Capture every moment' },
  { icon: Palette, label: 'Decoration', description: 'Venues, florals, styling' },
  { icon: Mic2, label: 'MC / Compere', description: 'Hosts who keep it moving' },
  { icon: Shirt, label: 'Fashion & Styling', description: 'Looks for the day' },
]

const steps = [
  {
    number: '01',
    title: 'Create your event',
    description:
      'Add the date, location, and what you are celebrating. Invite collaborators so everyone sees the same plan.',
  },
  {
    number: '02',
    title: 'Set your budget',
    description:
      'Enter your total budget and we break it down by category — catering, decor, photography and more.',
  },
  {
    number: '03',
    title: 'Find & book vendors',
    description:
      'Browse local vendors, send inquiries, get quotes, and keep bookings in one place.',
  },
]

const features = [
  {
    icon: Sparkles,
    title: 'AI-powered planning',
    description:
      'Get a personalised event timeline and checklist so you know what to do next.',
  },
  {
    icon: Wallet,
    title: 'Smart budget tracker',
    description:
      'See exactly where your money goes. Budget items update automatically as you book vendors.',
  },
  {
    icon: Users,
    title: 'Vetted local vendors',
    description:
      'Every vendor on Djanora is reviewed by the community and ready to book.',
  },
  {
    icon: CalendarDays,
    title: 'Event timeline',
    description:
      'From first inquiry to the day of — keep the schedule, checklist, and vendors in one place.',
  },
]

export function LandingPage() {
  return (
    <>
      <Navbar />

      <main id="main-content">
        {/* ── HERO ────────────────────────────────────────────── */}
        <section
          className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
          aria-labelledby="hero-heading"
        >
          {/* Subtle dot pattern background */}
          <div
            className="absolute inset-0 pattern-adire opacity-40"
            aria-hidden="true"
          />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[var(--color-background)] via-transparent to-[var(--color-background)]"
            aria-hidden="true"
          />

          <div className="relative max-w-5xl mx-auto text-center">
            {/* Location badge */}
            <div className="inline-flex items-center gap-1.5 bg-brand-100 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <MapPin size={12} aria-hidden="true" />
              <span>Ottawa, Ontario — event planning</span>
            </div>

            <h1
              id="hero-heading"
              className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold text-brand-900 leading-tight mb-6"
            >
              Your event.
              <br />
              <span className="text-gold-600">Your plan.</span>
              <br />
              Your way.
            </h1>

            <p className="text-lg sm:text-xl text-[var(--color-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
              Djanora helps you plan your event — budget, vendors, guests, and the day-of schedule —
              all in one place.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-600 text-white font-medium text-base px-8 py-4 rounded-full transition-colors shadow-lg shadow-brand-900/20"
              >
                Start planning for free
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="/vendors"
                className="inline-flex items-center gap-2 text-brand-700 hover:text-brand-600 font-medium text-base px-6 py-4 rounded-full border border-brand-200 hover:border-brand-300 transition-colors"
              >
                Browse vendors
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--color-muted)]">
              <div className="flex items-center gap-1.5">
                <div className="flex" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="fill-gold-500 text-gold-500"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span>Loved by Ottawa families</span>
              </div>
              <span aria-hidden="true" className="hidden sm:block text-[var(--color-border)]">
                •
              </span>
              <span>Budget, vendors, and guests in one place</span>
              <span aria-hidden="true" className="hidden sm:block text-[var(--color-border)]">
                •
              </span>
              <span>100% free to start</span>
            </div>
          </div>
        </section>

        {/* ── VENDOR CATEGORIES ───────────────────────────────── */}
        <section
          className="py-16 px-4 sm:px-6 lg:px-8 bg-brand-50"
          aria-labelledby="categories-heading"
        >
          <div className="max-w-7xl mx-auto">
            <h2
              id="categories-heading"
              className="text-center font-display text-2xl font-semibold text-brand-800 mb-2"
            >
              Everything you need, in one place
            </h2>
            <p className="text-center text-[var(--color-muted)] mb-10">
              Vendors for every part of the day
            </p>

            <ul
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
              role="list"
              aria-label="Vendor categories"
            >
              {vendorCategories.map(({ icon: Icon, label, description }) => (
                <li key={label}>
                  <Link
                    href={`/vendors?category=${label.toLowerCase().replace(/ /g, '-')}`}
                    className="flex flex-col items-center text-center p-4 bg-white rounded-2xl border border-[var(--color-border)] hover:border-brand-300 hover:shadow-md transition-all group"
                  >
                    <span className="w-12 h-12 rounded-xl bg-brand-100 group-hover:bg-brand-200 flex items-center justify-center mb-3 transition-colors">
                      <Icon size={22} className="text-brand-700" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-brand-800 mb-1">{label}</span>
                    <span className="text-xs text-[var(--color-muted)] leading-relaxed">
                      {description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="py-24 px-4 sm:px-6 lg:px-8"
          aria-labelledby="how-it-works-heading"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="how-it-works-heading"
                className="font-display text-4xl font-semibold text-brand-900 mb-4"
              >
                Plan your event in 3 steps
              </h2>
              <p className="text-[var(--color-muted)] text-lg max-w-xl mx-auto">
                No more Googling vendors, guessing at traditions, or spreadsheet budgets.
              </p>
            </div>

            <ol className="grid md:grid-cols-3 gap-8" role="list">
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="relative flex flex-col p-8 bg-white rounded-3xl border border-[var(--color-border)] shadow-sm"
                >
                  <span
                    className="font-display text-5xl font-bold text-brand-100 mb-6 leading-none"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <h3 className="font-display text-xl font-semibold text-brand-800 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-[var(--color-muted)] text-sm leading-relaxed">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>

            <div className="text-center mt-12">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-600 text-white font-medium px-8 py-4 rounded-full transition-colors"
              >
                Start for free
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section
          className="py-24 px-4 sm:px-6 lg:px-8 bg-brand-900"
          aria-labelledby="features-heading"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2
                id="features-heading"
                className="font-display text-4xl font-semibold text-white mb-4"
              >
                Built for planners and vendors
              </h2>
              <p className="text-brand-300 text-lg max-w-xl mx-auto">
                Keep the plan, the people, and the budget together so nothing slips through.
              </p>
            </div>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" role="list">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="flex flex-col p-6 bg-brand-800 rounded-2xl border border-brand-700"
                >
                  <span className="w-10 h-10 rounded-xl bg-gold-600/20 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-gold-400" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold text-white mb-2">{title}</h3>
                  <p className="text-sm text-brand-300 leading-relaxed">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── FOR VENDORS ─────────────────────────────────────── */}
        <section
          id="for-vendors"
          className="py-24 px-4 sm:px-6 lg:px-8"
          aria-labelledby="vendors-cta-heading"
        >
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-gold-600 mb-4">
                  For vendors
                </span>
                <h2
                  id="vendors-cta-heading"
                  className="font-display text-4xl font-semibold text-brand-900 mb-6 leading-tight"
                >
                  Reach planners who are ready to book
                </h2>
                <p className="text-[var(--color-muted)] text-lg leading-relaxed mb-8">
                  Create a portfolio, showcase your work, and get discovered by people planning
                  events. No commission on bookings — you keep what you earn.
                </p>

                <ul className="flex flex-col gap-3 mb-8" role="list">
                  {[
                    'Free to create a profile',
                    'Reach planners who are ready to book',
                    'Manage inquiries in one dashboard',
                    'No booking commissions',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-brand-800">
                      <CheckCircle2 size={18} className="text-brand-500 shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/vendor/sign-up"
                  className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-500 text-white font-medium px-8 py-4 rounded-full transition-colors"
                >
                  Join as a vendor
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </div>

              {/* Visual card */}
              <div
                className="relative bg-brand-800 rounded-3xl p-8 text-white overflow-hidden"
                aria-hidden="true"
              >
                <div className="absolute inset-0 pattern-adire opacity-10" />
                <div className="relative">
                  <div className="text-4xl mb-4">🎊</div>
                  <p className="font-display text-2xl font-semibold mb-2">
                    &ldquo;Finally, a platform that keeps the whole event in one place.&rdquo;
                  </p>
                  <p className="text-brand-300 text-sm">— Ottawa vendor community</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────── */}
        <section
          className="py-24 px-4 sm:px-6 lg:px-8 bg-gold-50 border-y border-gold-100"
          aria-labelledby="final-cta-heading"
        >
          <div className="max-w-3xl mx-auto text-center">
            <h2
              id="final-cta-heading"
              className="font-display text-4xl sm:text-5xl font-semibold text-brand-900 mb-6"
            >
              Your event starts here
            </h2>
            <p className="text-[var(--color-muted)] text-lg mb-10">
              Free to start. No credit card required. Plan your event with vendors, budget, and
              guests in one place.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-brand-700 hover:bg-brand-600 text-white font-medium text-lg px-10 py-5 rounded-full transition-colors shadow-xl shadow-brand-900/20"
            >
              Start planning your event
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
