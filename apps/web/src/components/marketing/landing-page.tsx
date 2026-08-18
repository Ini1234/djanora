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
    description: 'Get a personalised event timeline and checklist so you know what to do next.',
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
    description: 'Every vendor on Djanora is reviewed by the community and ready to book.',
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
          className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 lg:px-8"
          aria-labelledby="hero-heading"
        >
          {/* Subtle dot pattern background */}
          <div className="pattern-adire absolute inset-0 opacity-40" aria-hidden="true" />
          {/* Gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-[var(--color-background)] via-transparent to-[var(--color-background)]"
            aria-hidden="true"
          />

          <div className="relative mx-auto max-w-5xl text-center">
            <div className="chip mb-6">
              <MapPin size={12} aria-hidden="true" />
              <span>Ottawa, Ontario — event planning</span>
            </div>

            <h1
              id="hero-heading"
              className="font-display text-foreground mb-6 text-5xl leading-tight font-semibold sm:text-6xl lg:text-7xl"
            >
              Your event.
              <br />
              Your plan.
              <br />
              Your way.
            </h1>

            <p className="text-muted mx-auto mb-10 max-w-2xl text-lg leading-relaxed sm:text-xl">
              Djanora helps you plan your event — budget, vendors, guests, and the day-of schedule —
              all in one place.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                Start planning for free
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/vendors" className="btn btn-secondary btn-lg">
                Browse vendors
              </Link>
            </div>

            {/* Social proof */}
            <div className="text-muted mt-12 flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="flex" aria-label="5 star rating">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className="fill-foreground text-foreground"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <span>Loved by Ottawa families</span>
              </div>
              <span aria-hidden="true" className="text-border hidden sm:block">
                •
              </span>
              <span>Budget, vendors, and guests in one place</span>
              <span aria-hidden="true" className="text-border hidden sm:block">
                •
              </span>
              <span>100% free to start</span>
            </div>
          </div>
        </section>

        {/* ── VENDOR CATEGORIES ───────────────────────────────── */}
        <section
          className="bg-[var(--page-bg)] px-4 py-16 sm:px-6 lg:px-8"
          aria-labelledby="categories-heading"
        >
          <div className="mx-auto max-w-7xl">
            <h2
              id="categories-heading"
              className="font-display text-foreground mb-2 text-center text-2xl font-semibold"
            >
              Everything you need, in one place
            </h2>
            <p className="text-muted mb-10 text-center">Vendors for every part of the day</p>

            <ul
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
              role="list"
              aria-label="Vendor categories"
            >
              {vendorCategories.map(({ icon: Icon, label, description }) => (
                <li key={label}>
                  <Link
                    href={`/vendors?category=${label.toLowerCase().replace(/ /g, '-')}`}
                    className="card hover:border-foreground/20 group flex flex-col items-center p-4 text-center transition-all hover:shadow-md"
                  >
                    <span className="group-hover:bg-border mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--page-bg)] transition-colors">
                      <Icon size={22} className="text-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-foreground mb-1 text-sm font-semibold">{label}</span>
                    <span className="text-muted text-xs leading-relaxed">{description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="px-4 py-24 sm:px-6 lg:px-8"
          aria-labelledby="how-it-works-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2
                id="how-it-works-heading"
                className="font-display text-foreground mb-4 text-4xl font-semibold"
              >
                Plan your event in 3 steps
              </h2>
              <p className="text-muted mx-auto max-w-xl text-lg">
                No more Googling vendors, guessing at traditions, or spreadsheet budgets.
              </p>
            </div>

            <ol className="grid gap-8 md:grid-cols-3" role="list">
              {steps.map((step) => (
                <li key={step.number} className="card relative flex flex-col p-8 shadow-sm">
                  <span
                    className="font-display text-border mb-6 text-5xl leading-none font-bold"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <h3 className="font-display text-foreground mb-3 text-xl font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">{step.description}</p>
                </li>
              ))}
            </ol>

            <div className="mt-12 text-center">
              <Link href="/sign-up" className="btn btn-primary btn-lg">
                Start for free
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section
          className="panel-inverse px-4 py-24 sm:px-6 lg:px-8"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2
                id="features-heading"
                className="font-display text-inverse-foreground mb-4 text-4xl font-semibold"
              >
                Built for planners and vendors
              </h2>
              <p className="text-inverse-muted mx-auto max-w-xl text-lg">
                Keep the plan, the people, and the budget together so nothing slips through.
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
              {features.map(({ icon: Icon, title, description }) => (
                <li
                  key={title}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6"
                >
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-inverse-muted text-sm leading-relaxed">{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── FOR VENDORS ─────────────────────────────────────── */}
        <section
          id="for-vendors"
          className="px-4 py-24 sm:px-6 lg:px-8"
          aria-labelledby="vendors-cta-heading"
        >
          <div className="mx-auto max-w-5xl">
            <div className="grid items-center gap-12 md:grid-cols-2">
              <div>
                <span className="text-muted mb-4 inline-block text-xs font-semibold tracking-widest uppercase">
                  For vendors
                </span>
                <h2
                  id="vendors-cta-heading"
                  className="font-display text-foreground mb-6 text-4xl leading-tight font-semibold"
                >
                  Reach planners who are ready to book
                </h2>
                <p className="text-muted mb-8 text-lg leading-relaxed">
                  Create a portfolio, showcase your work, and get discovered by people planning
                  events. No commission on bookings — you keep what you earn.
                </p>

                <ul className="mb-8 flex flex-col gap-3" role="list">
                  {[
                    'Free to create a profile',
                    'Reach planners who are ready to book',
                    'Manage inquiries in one dashboard',
                    'No booking commissions',
                  ].map((item) => (
                    <li key={item} className="text-foreground flex items-center gap-3 text-sm">
                      <CheckCircle2 size={18} className="text-muted shrink-0" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link href="/vendor/sign-up" className="btn btn-primary btn-lg">
                  Join as a vendor
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </div>

              {/* Visual card */}
              <div
                className="panel-inverse relative overflow-hidden rounded-3xl p-8"
                aria-hidden="true"
              >
                <div className="pattern-adire absolute inset-0 opacity-10" />
                <div className="relative">
                  <div className="mb-4 text-4xl">🎊</div>
                  <p className="font-display mb-2 text-2xl font-semibold">
                    &ldquo;Finally, a platform that keeps the whole event in one place.&rdquo;
                  </p>
                  <p className="text-inverse-muted text-sm">— Ottawa vendor community</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────── */}
        <section
          className="border-border border-y px-4 py-24 sm:px-6 lg:px-8"
          aria-labelledby="final-cta-heading"
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2
              id="final-cta-heading"
              className="font-display text-foreground mb-6 text-4xl font-semibold sm:text-5xl"
            >
              Your event starts here
            </h2>
            <p className="text-muted mb-10 text-lg">
              Free to start. No credit card required. Plan your event with vendors, budget, and
              guests in one place.
            </p>
            <Link href="/sign-up" className="btn btn-primary btn-lg text-lg">
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
