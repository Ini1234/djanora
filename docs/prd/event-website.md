# Event website

| Field     | Value                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Author    | Product (locked grill-me, 2026-09-02 → 2026-09-03)                                                                                             |
| Date      | 2026-09-03                                                                                                                                     |
| Status    | **Draft** — spec in review at `docs/specs/event-website.md`. No code until that spec is **Approved**.                                          |
| Reviewers | Host-product owner, design, engineering                                                                                                        |
| Template  | Standard PRD (cross-team, new guest surface)                                                                                                   |
| Apps      | `apps/api` (Nest + Prisma), `apps/web` (Next.js App Router)                                                                                    |
| HTTP      | Browser: `proxyClient` for host/editor. Public guest: `publicGet` / `backend`. No `fetch()` in `apps/web`. No new dedicated proxy route files. |

---

## Problem

A host can plan an Event (budget, checklist, schedule, guests) and send a secret `/rsvp/[token]` link. They cannot give guests **one page** for the occasion: when, where, who, photos, FAQ, gifts, travel, and RSVP.

Guests today live in WhatsApp, Google Docs, and wedding-site products (WithJoy, Zola). Djanora already has the Event, the guest list, and parent/child ceremonies. The missing product is a **shareable Event site** on top of that, generic enough for a birthday or naming ceremony, not a wedding CMS.

## Who

| Person                                        | In this product                              | Job on the site                                                                |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| **Host**                                      | `Event.userId`                               | Create, configure, publish, unpublish, republish, delete, grant site access    |
| **Editor with site grant**                    | `EventMember` role `EDITOR` + new site grant | Same as host for the site only. Grant does not exist today; we add it on share |
| **Commenter / Viewer / Editor without grant** | Existing members                             | Cannot create or change the site                                               |
| **Guest**                                     | `Guest` + `GuestInvite` on an Event          | Pass the gate, see only Events they are allowed to see, RSVP on those Events   |

There is no Planner role. “Planner” in conversation means host or editor with site grant.

## Success metrics

Define before build. Targets are directional; refine at kickoff.

| Metric                | Definition                                                    | Target (first 90 days after ship)                   |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| **Site created**      | Host/editor completes create (draft exists)                   | ≥ 40% of newly created parent Events                |
| **Published**         | Site reaches `published` at least once                        | ≥ 50% of created sites                              |
| **Guest unlock**      | Unique guest session that passes the gate                     | ≥ 5 per published site (median)                     |
| **RSVP through site** | RSVP write attributed to a site door (not only raw token URL) | ≥ 30% of RSVPs on Events that have a published site |
| **Support load**      | Tickets: “guest can’t see X” / “wrong ceremony showing”       | < 5% of published sites                             |

**Not success:** pageviews, time on page, or “looks like WithJoy.”

## Goals

1. A host can publish a public Event page at `/e/[slug]` without leaving Djanora.
2. A parent Event can include selected children on one URL; each Event can still have its own site.
3. Guests see only what they are allowed to see, using the guest list (or open-URL mode).
4. RSVP stays on the Event. The site is a door, not a second guest list.
5. The content model is generic. Wedding is a future template, not the schema.

---

## User journeys

### Host publishes a parent site

1. Open a top-level Event → **Create site**.
2. Pick slug, preset + pickers (theme, fonts, colors, buttons, cover).
3. Turn sections on/off and reorder.
4. Select which **child Events** to include.
5. For each included child, choose whether that child has its **own guest list** (and thus RSVP + visibility).
6. For Schedule, turn **show on site** on for guest-safe items only (default off).
7. Set each included Event’s gate mode: **open-URL** or **invited-only**.
8. Preview as draft. **Publish**. Share `https://djanora.com/e/{slug}`.

### Guest invited only to the reception

1. Opens the parent URL (the one the couple texted).
2. Gate: email (must match that child’s invite) or unique invite code.
3. Sees only the reception (and any other Event they are on, or any **open** Event included on that site).
4. RSVPs on the reception. Write goes to the reception Event’s guest list.
5. If they later open the reception’s own site URL, same list, same RSVP.

### Guest on an open Event

1. Opens `/e/{slug}` with no invite.
2. If that Event is open-URL, they see it and can RSVP (they are added to / matched on that Event’s guest list).
3. They still cannot see invited-only Events they are not on.

---

## Feature inventory (all v1 — do not park)

### Site attachment

- Every Event MAY have **at most one** site.
- A parent site MAY include child Events. Inclusion is a host choice at create/configure, not automatic.
- A child MAY be included on the parent site **and** have its own published site at the same time.

### RSVP

- RSVP is owned by the **Event**, never by the site.
- Parent site and child site are doors into the same Event guest list.
- Host/editor with site grant chooses per child: **own guest list** (RSVP + visibility) or **content/schedule only**.
- Invited-only RSVP/entry: **email lookup** against who is invited, or **unique code** (existing `GuestInvite.token`). Existing `/rsvp/[token]` pages keep working.
- Open-URL: anyone who can see that Event can RSVP; the system creates or matches a Guest on that Event.

### Access (gate + visibility)

- The gate applies to the **whole site**, then to **each Event** on it.
- **Invited-only Event:** guest list membership = visibility. Off the list → that Event is omitted (no placeholder that reveals it).
- **Open-URL Event:** visible and RSVP-able without prior invite.
- A guest who is only on a **child** list MAY enter via the **parent** URL with that child’s email or code. The parent site filters to Events they may see.
- Identity after the gate persists for the browser session (cookie). Closing the tab may require the gate again; spec will set TTL.

### Who can build

- Default: **host only**.
- **Add** a site-access grant to the existing Event share flow (not a new role). An `EDITOR` with that grant MAY create, configure, publish, unpublish, republish, and delete the site.
- Commenter, Viewer, and Editor without the grant MUST NOT.

### Section kit (fixed, reorderable, extensible registry)

| Section      | On by default? | Content source                                                                                                                                         |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cover**    | Always on      | Title, date, location live from Event; cover photo is site-only                                                                                        |
| **About**    | Off            | Site-only text                                                                                                                                         |
| **Schedule** | Off            | Live from Event schedule + included children as stops. Per-item **show on site**, default **off**. Never expose budget, checklist, or mood-board links |
| **Where**    | Off            | Live from Event location                                                                                                                               |
| **People**   | Off            | Live from the Event wedding-party roster. Per-person **show on site**, default **off**. Not the guest list                                             |
| **RSVP**     | Off            | Door into that Event’s guest list (and included children that have their own list)                                                                     |
| **Photos**   | Off            | Site-only public gallery. Not the private mood board                                                                                                   |
| **FAQ**      | Off            | Site-only Q&A                                                                                                                                          |
| **Gifts**    | Off            | Site-only links (registry, cash, wishlist)                                                                                                             |
| **Travel**   | Off            | Site-only notes                                                                                                                                        |

New section types MAY be added later via the registry. This build ships only the ten above.

### URL

- Public path: `/e/[slug]` on Djanora.
- Host picks a unique slug (global uniqueness).
- **No** custom domain. **No** subdomain.
- Slug MAY change after publish. The old slug **404s**. No redirect.

### Lifecycle

| Action       | Guest sees        | Data                                     |
| ------------ | ----------------- | ---------------------------------------- |
| Create       | 404               | Draft site exists                        |
| Publish      | Site (after gate) | Live                                     |
| Unpublish    | 404               | Site kept                                |
| Republish    | Site again        | Same site                                |
| Delete site  | 404               | Event, guests, schedule, budget **kept** |
| Delete Event | 404               | Site **removed** (cascade)               |

### Look

- Presets and pickers only: theme preset, font pair, color palette, button style, cover layout.
- Stack those selections. **No custom CSS.**

### Search

- Draft → `noindex`.
- Invited-only (even if published) → `noindex`.
- Open-URL + published → indexable, with Event structured data.

---

## UX flows (for design)

### Gate (published site)

```
GET /e/{slug}
  unpublished or missing → 404
  published → gate screen (email and/or unique code)
    open Events on this site are visible after a successful gate OR, if the
    visitor has not identified, only open Events (spec: exact empty-identity
    rule — see Open questions)
    invited-only Events require identity + membership
```

### Parent URL, child-only guest

```
Guest enters email/code for Reception
  → session bound to that Guest
  → render parent site
  → include Reception
  → include any other Event they belong to
  → include any open-URL Event on this site
  → omit all other invited-only children
```

### Share Event (existing flow + one control)

```
Invite editor
  role: EDITOR
  surfaces: existing tabs
  [ ] Site — create, configure, publish   ← new, default off
```

---

## Out of scope

Explicitly rejected for this build. Do not implement “while we’re in there.”

- Custom domains, wildcard subdomains, customer SSL
- Freeform builder, custom HTML, custom CSS
- Wedding-only section names or a Wedding CMS
- A second guest list stored on the site
- Redirects from old slugs
- Replacing `/rsvp/[token]` (it stays)
- Site access for Commenter or Viewer
- Using the private mood board as the public gallery
- Publishing budget, checklist, or planner notes
- A new Planner role
- Multi-site per Event
- Native apps, PDF save-the-date, SMS blast
- Guest accounts / Clerk login for guests

---

## Dependencies (already in product)

| Existing                                  | Reuse                                                     |
| ----------------------------------------- | --------------------------------------------------------- |
| `Event` + `parentId` / children           | Site attaches to Event; parent includes selected children |
| `Guest` + `GuestInvite` + `/rsvp/:token`  | Guest list, unique code, RSVP write                       |
| `EventMember` + `EDITOR` + `EventSurface` | Share flow; **add** site grant                            |
| `EventScheduleItem`                       | Live Schedule; add `showOnSite` (name TBD in spec)        |
| `/vendors/[slug]`                         | Pattern for public `/e/[slug]`                            |
| `publicGet` / `backend`                   | Guest HTTP. Host/editor use `proxyClient`                 |

---

## Risks

| Risk                          | Why it matters                | Mitigation in this PRD                           |
| ----------------------------- | ----------------------------- | ------------------------------------------------ |
| Guest sees a hidden ceremony  | Trust; family politics        | Fail closed; omit, do not 403-hint; API enforced |
| Double RSVP                   | Two sites, one Event          | One guest list per Event; both doors write there |
| Open vs invited contradiction | Stranger not on list          | Open Event is visible without membership         |
| Schedule leak                 | Planning notes go public      | Per-item show flag, default off                  |
| Custom domain expectation     | Wedding-site comparison       | Explicitly out of scope; slug only               |
| Azure SWA domain cap          | Cannot host per-event domains | Do not start that path                           |

---

## Open questions

All five defaults are **locked** in [`docs/specs/event-website.md`](../specs/event-website.md):

1. Empty identity → only OPEN Events.
2. 24 gallery images / site, 8 MB, jpeg/png/webp.
3. Gate session 30 days, `X-Event-Site-Session`.
4. Slug 3–48 kebab + reserved list.
5. `EventSurface.SITE` grant on EDITOR, default off. Not a planning tab.

---

## Launch

- Ship behind the existing Event page: **Create site** on Events the viewer may configure.
- Public route `/e/[slug]` is unauthenticated except for the site gate.
- Analytics: create, publish, unpublish, delete, gate success/fail, RSVP via site (needed for success metrics).

## Sign-off

| Role        | Name | Date | Verdict |
| ----------- | ---- | ---- | ------- |
| Product     |      |      |         |
| Design      |      |      |         |
| Engineering |      |      |         |

After sign-off: write the Approved spec (`spec-driven-workflow`) before code.
