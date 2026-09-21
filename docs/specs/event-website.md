# Event website

| Field     | Value                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Author    | Product + engineering (grill-me + PRD `docs/prd/event-website.md`)                                                                    |
| Date      | 2026-09-03                                                                                                                            |
| Status    | **Approved** — 2026-09-03. Implementation may proceed.                                                                                |
| Reviewers | Host-product owner, design, engineering                                                                                               |
| Apps      | `apps/api` (Nest + Prisma), `apps/web` (Next.js App Router)                                                                           |
| HTTP      | Host/editor: `proxyClient` → `/api/proxy/*` → Nest. Guest: `publicGet` / `backend`. No `fetch()`. No new dedicated proxy route files. |
| Source    | [PRD](../prd/event-website.md)                                                                                                        |

PRD open-question defaults are **locked** here: mixed-site empty identity shows only open Events; 24 photos / site; 30-day session; kebab slug + reserved list; `EventSurface.SITE`.

---

## 1. Context

Djanora Events are private planning workspaces: budget, checklist, schedule, guests, parent/child ceremonies. The only guest page is `/rsvp/[token]`. Hosts cannot share one URL for when, where, people, photos, and RSVP. They leave the product for WithJoy / docs / WhatsApp.

The product already has the data a site needs: `Event` (title, date, location, `parentId` tree), `EventScheduleItem`, `Guest` + `GuestInvite`, public slug pattern on `/vendors/[slug]`, and share via `EventMember` + `EventSurface`.

This spec adds an **Event site**: one optional public page per Event at `/e/[slug]`, a fixed section kit, guest-list visibility, open vs invited-only gates, and a new **SITE** grant on share. Wedding is not a type in this model. Custom domains are rejected (Azure SWA cannot host per-event domains).

---

## 2. Functional Requirements

### Attachment and inclusion

- **FR-1.** An Event MUST have at most one `EventSite`. Creating a second MUST fail `409`.
- **FR-2.** A host or SITE editor MUST be able to include **direct children** (`parentId = this Event`) on a parent site. Inclusion is an explicit list. Children MUST NOT be included automatically.
- **FR-3.** Including a child MUST NOT prevent that child from having its own `EventSite`. Both MAY be `PUBLISHED` at once.
- **FR-4.** A child Event’s site MUST NOT include siblings or its parent. `includedEventIds` on a child site MUST be empty or rejected `400`.
- **FR-5.** Soft-deleted Events MUST 404 for site editor and guest routes. Deleting an Event MUST delete its `EventSite` and media rows (cascade). Deleting a site MUST NOT delete the Event, guests, or schedule.

### Who can configure

- **FR-6.** The Event host (`Event.userId`) MUST be able to create, configure, publish, unpublish, republish, and delete the site.
- **FR-7.** Prisma MUST add `EventSurface.SITE`. SITE is a **grant only**. It MUST NOT appear as a planning tab. `ALL_SURFACES` / unread / journey surfaces are the planning values (`SCHEDULE`, `CHECKLIST`, `BUDGET`, `MOODBOARD`, `VENDORS`, `GUESTS`, `PARTY`). SITE MUST stay excluded. Host access MUST imply SITE without storing it. `PARTY` is a planning tab (Wedding party) and an invite opt-in; it MUST NOT be granted by default. The tab MUST appear only after the host enables `Event.partyEnabled`.
- **FR-8.** An accepted `EDITOR` whose `surfaces` includes `SITE` MUST have the same site mutations as the host. Commenter, Viewer, Editor without SITE, and unaccepted invites MUST receive `404` “Event not found” on site editor routes (fail closed; do not confirm the Event).
- **FR-9.** Invite and update-member DTOs MUST accept `SITE` in `surfaces`. The share UI MUST show a **Site** checkbox, default **off**, only when role is `EDITOR`. Checking Site for Commenter or Viewer MUST `400`.
- **FR-10.** Removing SITE from an editor MUST take effect immediately. In-flight drafts stay; they can no longer PATCH.

### Lifecycle and slug

- **FR-11.** Create MUST store status `DRAFT`. Guests MUST receive `404` for draft and unpublished sites (same body as unknown slug).
- **FR-12.** Publish MUST set `PUBLISHED` and `publishedAt` (first publish keeps the original `publishedAt` on republish). Unpublish MUST set `DRAFT` and MUST NOT delete content. Republish is Publish on an existing row.
- **FR-13.** Delete site MUST remove the `EventSite`, sections, photos, and cover blob. Slug MUST become available.
- **FR-14.** Slug MUST be globally unique among non-deleted sites. Format: lowercase kebab, length 3–48, `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Reserved: `www`, `api`, `admin`, `vendors`, `vendor`, `rsvp`, `e`, `events`, `event`, `site`, `sites`, `event-sites`, `inspiration`, `inquiries`, `messages`, `settings`, `onboarding`, `sign-in`, `sign-up`, `dashboard`, `likes`, `portfolio`. Collision or reserved → `400`.
- **FR-15.** The host MAY change the slug while draft or published. The previous slug MUST 404. The system MUST NOT redirect.

### Sections and live data

- **FR-16.** The section registry MUST be: `COVER`, `ABOUT`, `DRESS_CODE`, `SCHEDULE`, `WHERE`, `PEOPLE`, `RSVP`, `PHOTOS`, `FAQ`, `GIFTS`, `TRAVEL`, `STAY`, plus host-added `CUSTOM`. Cover MUST always be enabled. Other sections MUST default disabled. Host MUST be able to enable, disable, and reorder (except Cover stays first).
- **FR-17.** Title, `estimatedDate`, and `location` on Cover and Where MUST be read live from the Event at request time. The site MUST NOT store copies of those fields.
- **FR-18.** Schedule on the site MUST be a live composed view: `EventScheduleItem` rows on that Event with `showOnSite = true`, plus included children as stops (child title, date, location) when the viewer may see that child. Budget, checklist, and mood-board links MUST be omitted.
- **FR-19.** `EventScheduleItem` MUST gain `showOnSite Boolean @default(false)`. Host/SITE editor MUST be able to toggle it. Schedule-tab editors without SITE MAY toggle it (it is a schedule field). Default off.
- **FR-20.** About, FAQ, Gifts, Travel, cover photo, and gallery MUST be site-only JSON / rows. They MUST NOT write to mood board, notes, or budget. People MUST be a live projection of `EventPartyMember` on the owner Event (not site-only JSON, not guests, not event members).
- **FR-21.** People on the guest site MUST be `{ id, name, role, side?, group?, bio?, pairedWithId? }` for members with `showOnSite = true` (max 40). Public GET MUST omit `status` (asked / confirmed / declined). FAQ `{ question, answer }` (max 30). Gifts `{ label, url }` (max 20). Travel, Stay, Dress Code, and Custom body are text (max 8_000 chars). About is constrained rich text (same sanitizer as Story HTML; no `<img>`, no custom CSS).

### Look

- **FR-22.** Look MUST be catalogs only: `themePreset`, `fontPair`, `colorPalette`, `buttonStyle`, `coverLayout` (`full-bleed` = photo on top, `split` = photo beside the text, `centered` = photo underneath), `coverPhotoSide` (`left` | `right`, used when `coverLayout` is `split`), `navPlacement`, `navStyle` (`line` | `pill` | `underline` | `solid`), `navAlign` (`above` | `before` | `below`), `navBorder` (`on` | `off`), `navBorderWidth` (`thin` | `medium` | `thick`), `navBorderStyle` (`solid` | `dashed` | `dotted`). Optional `navName` (plain text, max 80) is the invitation heading; empty uses the live Event title when that title is visible. `showEventType` and `showEventTitle` (booleans, default false) show or hide the live Event type and title on the cover (FR-17). The public GET MUST omit `owner.title` when `showEventTitle` is false and omit `owner.eventType` when `showEventType` is false. The cover rule MUST NOT render when both are hidden. Where still reads location from the Event (FR-17). Unknown catalog value → `400`. Custom CSS or arbitrary class strings MUST be rejected.

### Photos

- **FR-23.** Cover is one image. Gallery MUST allow at most **24** images per site (`EventSitePhoto.sectionId` null). Section heroes MUST allow at most **20**. Party person photos MUST allow at most **40**. Upload via existing `BlobStorageService` kind `images` and `makeUploadName`. MIME: jpeg, png, webp. Max 8 MB per file.
- **FR-24.** Guest payloads MUST return public upload URLs (`public-upload-url`), never storage keys. Mood-board items MUST NOT appear in the gallery unless the host re-uploads them to the site.

### Access modes and visibility

- **FR-25.** Each Event appearing on a site (owner Event + each included child) MUST have `accessMode`: `OPEN` or `INVITED_ONLY`. Default `INVITED_ONLY`.
- **FR-26.** Each included child MUST have `hasOwnGuestList` (default `true`). If `false`, that child is schedule/content only: no RSVP door, and visibility follows the **parent** Event’s guest list (or OPEN if the child’s `accessMode` is `OPEN`).
- **FR-27.** Invited-only + `hasOwnGuestList`: a viewer MAY see that Event iff their session Guest is on that Event’s `Guest` list (email match, case-insensitive trim, or invite token).
- **FR-28.** `OPEN`: a viewer MAY see that Event without being on the list. They MAY RSVP; the system MUST create a Guest + GuestInvite if no email match exists (email required on open RSVP).
- **FR-29.** Empty identity (no valid session): the public GET MUST return only Events on that site with `accessMode = OPEN` (and their allowed sections). Invited-only Events MUST be omitted. Cover of the owner Event MUST still render with live title, date, and location (FR-17). The API MUST NOT return that Event’s id, schedule, or RSVP until the guest may see it.
- **FR-30.** A Guest who is only on a child list MUST be able to POST session on the **parent** slug with that child’s email or token. After success, GET MUST include that child and any other Event they may see (membership or OPEN).
- **FR-31.** Hidden Events MUST be omitted. The API MUST NOT return their ids, titles, or counts. Fail closed: wrong email/code → `401` with generic “We couldn’t find that invite.” Do not say which Event they missed.
- **FR-32.** Unique code MUST be the existing `GuestInvite.token` (any Event that appears on this site). `/rsvp/:token` MUST keep working unchanged.

### Guest session

- **FR-33.** `POST /event-sites/:slug/session` with `{ email }` or `{ code }` MUST create a signed opaque session (HMAC, payload: `siteId`, `guestId` nullable, `exp`). TTL **30 days**. Response body: `{ token, expiresAt }`. Client MUST send `X-Event-Site-Session` on later public calls. Store in `localStorage` key `djanora.eventSite.{slug}`.
- **FR-34.** Invalid, expired, or site-mismatch token MUST be treated as empty identity (FR-29), not 500. POST session with unknown email/code MUST `401` as FR-31.
- **FR-35.** Session is not a Clerk user. Site editor routes MUST keep Clerk + SITE grant.

### RSVP via site

- **FR-36.** `POST /event-sites/:slug/rsvp` MUST write to the target Event’s `GuestInvite` (`rsvpStatus`, `rsvpAt`, plus-one, dietary, message) using the same fields as `SubmitRsvpDto`.
- **FR-37.** Target `eventId` MUST be the owner Event or an included child with `hasOwnGuestList = true` that the viewer MAY see. Otherwise `404`.
- **FR-38.** Invited-only RSVP: session MUST already identify a Guest on that Event, or the body MUST include email/code that matches. Open RSVP: body MUST include email; create Guest if needed (firstName from email local-part if name absent; lastName optional).
- **FR-39.** Public RSVP responses MUST use the same projection as `toPublicRsvp` (no guest email, phone, table, `event.notes`).

### Public page and SEO

- **FR-40.** Next route MUST be `apps/web/src/app/e/[slug]/page.tsx` (public, no Clerk). It MUST load Nest `GET /event-sites/:slug`. 404 page when Nest 404s.
- **FR-41.** Draft, unknown slug, unpublished: HTTP 404. Invited-only owner (and mixed with no OPEN events visible to this identity): `robots` `noindex`. OPEN + `PUBLISHED` and at least one visible OPEN Event: indexable. JSON-LD `Event` MUST use only visible fields (name, startDate, location). Omit `name` when `owner.title` is empty.
- **FR-42.** Guest UI MUST honor `prefers-reduced-motion` on decorative motion. Cover image MUST have alt (Event title). RSVP controls MUST be keyboard reachable.

### Section media, party, catalogs, RSVP options

- **FR-43.** One hero image MAY be attached to `ABOUT`, `DRESS_CODE`, `STAY`, `TRAVEL`, `WHERE`, `SCHEDULE`, `FAQ`, `GIFTS`, `RSVP`, `CUSTOM`. `COVER` (has cover), `PHOTOS` (gallery), and `PEOPLE` (per-person photos) MUST reject a section hero. Placement follows the section `layout` (`vertical` above, `horizontal` beside). Guest payloads MUST return public URLs, never storage keys.
- **FR-44.** People style MUST be catalog `circles` | `cards`. Schedule style MUST be `list` | `timeline` | `cards`, plus `groupByDay`, `showTimes`, `showItemDirections`, and optional `note`. Where map MUST be `off` | `link` | `embed` (URLs derived from the Event address string; no geocoding keys). FAQ style `stack` | `accordion`. Gifts style `links` | `buttons`. Photos style MUST be `grid` | `slider`. Photos size MUST be `small` | `medium` | `large`. Guests MUST be able to open a gallery photo at full size. Unknown catalog values → `400` or coerced to the default.
- **FR-45.** RSVP section MAY set `intro`, `rsvpOpen`, `allowMaybe`, `collectPlusOne`, `collectDietary`, `collectMessage`, and optional `deadline` (`YYYY-MM-DD`). `POST /event-sites/:slug/rsvp` MUST reject when the RSVP section is missing or disabled, when closed or past deadline, reject `MAYBE` when `allowMaybe` is false, and MUST strip plus-one / dietary / message when those collect flags are off. Public GET MUST omit gallery photos when PHOTOS is disabled, omit schedule items when SCHEDULE is disabled, omit schedule times when `showTimes` is false, omit per-stop directions URLs when `showItemDirections` is false, and omit RSVP status / `canRsvp` when RSVP is disabled. Gift URLs MUST be http(s)/mailto/tel only. Access remains `ownerAccessMode` + child `accessMode` / `hasOwnGuestList` (no second guest list). Frontend limits MUST be enforced on Nest — hiding a control in the editor or guest page is not sufficient.

---

## 3. Non-Functional Requirements

- **NFR-1.** No new `app/api/proxy/**/route.ts`. Catch-all only.
- **NFR-2.** Browser HTTP: `proxyClient` (editor), `backend` / `publicGet` (guest). Axios only.
- **NFR-3.** Public GET `/event-sites/:slug` p95 < 500 ms excluding image bytes, for a site with ≤ 5 included children and ≤ 24 photos (metadata only).
- **NFR-4.** Public event-site routes MUST use `ThrottlerGuard`: 30 req / 60 s / IP on GET; 10 req / 60 s / IP on session and RSVP.
- **NFR-5.** Session HMAC secret MUST come from env (`EVENT_SITE_SESSION_SECRET`, ≥ 32 bytes). MUST NOT reuse Clerk keys.
- **NFR-6.** Guest PII in session token MUST be `guestId` only, not email.
- **NFR-7.** WCAG 2.2 AA on gate + guest page per `docs/standards/accessibility.md`. Contrast on preset palettes MUST be validated for body text ≥ 4.5:1. Palettes that fail MUST not ship. Side nav MUST collapse below `lg`. Every control MUST have a visible label or `aria-label`.
- **NFR-8.** Jest: site access (host / SITE editor / other), slug rules, visibility matrix (open / invited / child-only on parent), RSVP write target, schedule `showOnSite`, delete-site keeps Event.
- **NFR-9.** Fail closed on visibility. Prefer 404 over 403 on editor and guest “does this exist” paths.

---

## 4. Acceptance Criteria

- **AC-1.** (FR-1, FR-11, FR-12) Given a host with no site, when they POST site then GET `/e/{slug}` as a guest, then 404. When they publish, then 200.
- **AC-2.** (FR-1) Given a site exists, when they POST site again, then 409.
- **AC-3.** (FR-5, FR-13) Given a published site, when they DELETE the site, then Event and guests still GET; slug GET is 404.
- **AC-4.** (FR-5) Given a site, when they soft-delete the Event, then slug GET is 404.
- **AC-5.** (FR-8) Given an EDITOR without SITE, when they PATCH the site, then 404 and the site is unchanged.
- **AC-6.** (FR-9) Given invite role VIEWER with surfaces `[SITE]`, then 400.
- **AC-7.** (FR-14, FR-15) Given published slug `amaka-kemi`, when they change slug to `amaka-and-kemi`, then new slug 200 (if published) and `amaka-kemi` is 404.
- **AC-8.** (FR-14) Given slug `rsvp`, when they create, then 400.
- **AC-9.** (FR-18, FR-19) Given a schedule item with `showOnSite=false`, when a guest loads a visible Event, then that item is absent. When set true, then it is present without budget/checklist links.
- **AC-10.** (FR-23) Given 24 gallery images, when they upload a 25th, then 400.
- **AC-11.** (FR-29) Given parent site with OPEN reception and INVITED_ONLY naming, when GET without session, then payload has reception and no naming id or title.
- **AC-12.** (FR-30, FR-27) Given a Guest only on the naming Event, when they POST session on the parent slug with that email and GET, then naming is present and other invited-only children are absent.
- **AC-13.** (FR-31) Given a wrong email, when POST session, then 401 and message does not name an Event.
- **AC-14.** (FR-36, FR-37) Given dual published sites, when RSVP on parent door for child Event C, then C’s `GuestInvite.rsvpStatus` updates and parent Event’s invite does not.
- **AC-15.** (FR-28, FR-38) Given OPEN Event, when RSVP with a new email, then a Guest row exists on that Event and status is set.
- **AC-16.** (FR-39) Given site RSVP GET/response, then JSON has no guest email, phone, or `event.notes`.
- **AC-17.** (FR-41) Given INVITED_ONLY published site, then HTML includes `noindex`. Given OPEN published site, then Event JSON-LD is present.
- **AC-18.** (FR-3) Given child included on parent and child has its own published site, when guests hit both slugs with proper access, then both 200.
- **AC-19.** (FR-7) Given Event page nav, when SITE is granted, then no new planning tab named Site appears; Create/Edit site is a separate action.
- **AC-20.** (NFR-4) Given an IP, when it exceeds session POST limit, then 429.
- **AC-21.** (FR-43) Given a PEOPLE or PHOTOS section, when they POST a section hero, then 400. Given ABOUT, when they upload one hero, then GET returns a public URL on that section.
- **AC-22.** (FR-21, FR-44) Given an `EventPartyMember` with `showOnSite=true` and `peopleStyle=cards`, when a guest loads the site, then name, role, group, and bio render and unknown styles fall back to the default. Given `showOnSite=false` or PEOPLE disabled, that person is absent. Given a bride↔groom pair, both visible members render together. Confirmed/asked status MUST NOT appear on the guest payload.
- **AC-25.** (FR-44) Given PHOTOS `{ photosStyle: slider, photosSize: large }`, when a guest loads the site, then photos render as a one-at-a-time slideshow at large size and opening a photo shows the full image. Unknown style/size fall back to `grid` / `medium`.
- **AC-26.** (FR-22) Given `navName="Amaka & Kemi"` and `navAlign=before`, when a guest loads the site, then that name sits before the centered section words. Given `navAlign=below`, the name sits under the words. Empty `navName` uses the Event title. Unknown `navAlign` falls back to `above`. Given `navBorder=off`, the top nav has no bottom line. Given `navBorder=on` with `navBorderWidth=thick` and `navBorderStyle=dashed`, the top nav draws a thick dashed line. Unknown border catalogs fall back to `on` / `thin` / `solid`. Given `showEventType=false` and `showEventTitle=false` (the defaults), GET omits `owner.eventType` and `owner.title`, the cover hides those lines, and does not draw the rule under them. Given `coverLayout=split` and `coverPhotoSide=right`, the cover photo sits to the right of the text; unknown `coverPhotoSide` falls back to `left`. Given `coverLayout=centered`, the cover text comes first and the photo sits underneath.
- **AC-23.** (FR-45) Given `rsvpOpen=false` or a past `deadline`, when they POST RSVP, then 400. Given `allowMaybe=false`, when they POST `MAYBE`, then 400.
- **AC-24.** (FR-45) Given the RSVP section is disabled or absent, when they POST `/event-sites/:slug/rsvp`, then 400. Given a gift URL of `javascript:…`, when they PATCH or GET the public site, then that URL is dropped.

---

## 5. Edge Cases

- **EC-1.** Include a child that is not a direct child → `400`.
- **EC-2.** Include a soft-deleted child → omit or `400` on save; never show to guests.
- **EC-3.** Child detached from parent while still in `includedEventIds` → treat as not included on next GET; PATCH SHOULD drop the id.
- **EC-4.** Guest email matches two Guests on two included Events → session MAY bind both (payload `guestIds[]` or one token encoding multiple). GET shows union of allowed Events.
- **EC-5.** Same email on parent and child lists → one session unlocks both.
- **EC-6.** Open RSVP with email that already exists on that Event → update that invite; MUST NOT create a duplicate Guest.
- **EC-7.** Token RSVP and site RSVP for the same Guest → last write wins; one `GuestInvite` row.
- **EC-8.** Publish with no enabled sections except Cover → allowed.
- **EC-9.** Azure blob down on upload → `503`; site row unchanged.
- **EC-10.** HMAC secret missing in prod → process MUST refuse to start public session routes (fail boot or 503 all session/RSVP), MUST NOT sign with a hardcoded fallback.
- **EC-11.** Host previews draft: editor GET `/events/:id/site` returns full config. Guest slug stays 404 until publish.
- **EC-12.** Changing `accessMode` to INVITED_ONLY on a previously OPEN Event → existing open-created Guests remain on the list (they can still see it).
- **EC-13.** `hasOwnGuestList=false` and `INVITED_ONLY` → visibility uses parent guest list; RSVP door for that child MUST be hidden.
- **EC-14.** Parent Event is a child of another Event (`parentId` set) → it MAY have a site; it MUST NOT include children (FR-4).
- **EC-15.** Slug change while guest has localStorage for old slug → old session header on old slug 404s; they re-gate on the new slug.

---

## 6. API Contracts

Errors: `{ statusCode: 400 | 401 | 404 | 409 | 429 | 503; message: string }`

```ts
type SiteStatus = 'DRAFT' | 'PUBLISHED'
type AccessMode = 'OPEN' | 'INVITED_ONLY'
type SectionType =
  | 'COVER'
  | 'ABOUT'
  | 'SCHEDULE'
  | 'WHERE'
  | 'PEOPLE'
  | 'RSVP'
  | 'PHOTOS'
  | 'FAQ'
  | 'GIFTS'
  | 'TRAVEL'

type ThemePreset = 'linen' | 'ink' | 'garden' | 'midnight' | 'clay' | 'frost'
type FontPair = 'serif-sans' | 'sans-sans' | 'display-sans' | 'serif-serif'
type ColorPalette = 'ivory-gold' | 'stone-olive' | 'sand-terracotta' | 'slate-rose' | 'ink-cream'
type ButtonStyle = 'pill' | 'square' | 'underline'
type CoverLayout = 'full-bleed' | 'split' | 'centered'
type CoverPhotoSide = 'left' | 'right'

type SiteSection = {
  type: SectionType
  enabled: boolean
  sortOrder: number
  about?: string
  people?: { name: string; role: string }[]
  faq?: { question: string; answer: string }[]
  gifts?: { label: string; url: string }[]
  travel?: string
}

type IncludedEventConfig = {
  eventId: string
  accessMode: AccessMode
  hasOwnGuestList: boolean
}

// Editor — Clerk via proxyClient
// POST   /events/:eventId/site
// GET    /events/:eventId/site
// PATCH  /events/:eventId/site
// POST   /events/:eventId/site/publish
// POST   /events/:eventId/site/unpublish
// DELETE /events/:eventId/site
// POST   /events/:eventId/site/cover     multipart field "file"
// POST   /events/:eventId/site/photos    multipart field "file"
// DELETE /events/:eventId/site/photos/:photoId
// PATCH  /events/:eventId/schedule/:itemId  { showOnSite?: boolean }  (existing schedule PATCH + field)

type CreateSiteDto = {
  slug: string
  ownerAccessMode?: AccessMode // default INVITED_ONLY
  included?: IncludedEventConfig[]
}

type PatchSiteDto = {
  slug?: string
  ownerAccessMode?: AccessMode
  included?: IncludedEventConfig[]
  themePreset?: ThemePreset
  fontPair?: FontPair
  colorPalette?: ColorPalette
  buttonStyle?: ButtonStyle
  coverLayout?: CoverLayout
  coverPhotoSide?: CoverPhotoSide
  sections?: SiteSection[]
}

type EditorSite = {
  id: string
  eventId: string
  slug: string
  status: SiteStatus
  publishedAt: string | null
  ownerAccessMode: AccessMode
  included: IncludedEventConfig[]
  themePreset: ThemePreset
  fontPair: FontPair
  colorPalette: ColorPalette
  buttonStyle: ButtonStyle
  coverLayout: CoverLayout
  coverPhotoSide: CoverPhotoSide
  coverPhotoUrl: string | null
  photos: { id: string; url: string; sortOrder: number }[]
  sections: SiteSection[]
}

// Guest — backend / publicGet
// GET  /event-sites/:slug
//      header X-Event-Site-Session optional
// POST /event-sites/:slug/session   { email?: string; code?: string }
// POST /event-sites/:slug/rsvp      { eventId, email?, code?, status, plusOneName?, dietaryNote?, guestMessage? }

type PublicScheduleItem = {
  id: string
  title: string
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
}

type PublicEventSlice = {
  eventId: string
  title: string
  eventType: string
  estimatedDate: string | null
  location: string | null
  accessMode: AccessMode
  hasOwnGuestList: boolean
  schedule: PublicScheduleItem[]
  canRsvp: boolean
  rsvp?: {
    status: 'PENDING' | 'ATTENDING' | 'DECLINED' | 'MAYBE'
    rsvpAt: string | null
  } | null
}

type PublicSite = {
  slug: string
  status: 'PUBLISHED'
  look: {
    themePreset: ThemePreset
    fontPair: FontPair
    colorPalette: ColorPalette
    buttonStyle: ButtonStyle
    coverLayout: CoverLayout
    coverPhotoSide: CoverPhotoSide
    coverPhotoUrl: string | null
  }
  sections: SiteSection[] // enabled only; COVER always first
  photos: { id: string; url: string; sortOrder: number }[]
  owner: PublicEventSlice
  children: PublicEventSlice[] // visible only
  robots: 'index' | 'noindex'
}

type SiteSessionResponse = {
  token: string
  expiresAt: string // ISO
}
```

Share (existing endpoints, SITE allowed):

```ts
// POST /events/:id/members  InviteMemberDto.surfaces may include 'SITE'
// PATCH /events/:id/members/:memberId
```

---

## 7. Data Models

### `EventSurface` (enum add)

| Value | Notes                                         |
| ----- | --------------------------------------------- |
| SITE  | Grant only. Not a planning tab. Host implied. |

### `EventScheduleItem` (column add)

| Field      | Type    | Constraints   |
| ---------- | ------- | ------------- |
| showOnSite | Boolean | default false |

### `EventSite`

| Field           | Type      | Constraints                                                          |
| --------------- | --------- | -------------------------------------------------------------------- |
| id              | String    | cuid, PK                                                             |
| eventId         | String    | unique, FK Event, cascade                                            |
| slug            | String    | unique, 3–48, kebab                                                  |
| status          | Enum      | DRAFT \| PUBLISHED                                                   |
| publishedAt     | DateTime? | set on first successful publish                                      |
| ownerAccessMode | Enum      | OPEN \| INVITED_ONLY, default INVITED_ONLY                           |
| themePreset     | Enum      | see FR-22                                                            |
| fontPair        | Enum      |                                                                      |
| colorPalette    | Enum      |                                                                      |
| buttonStyle     | Enum      |                                                                      |
| coverLayout     | Enum      | full-bleed (photo on top) \| split (beside) \| centered (underneath) |
| coverPhotoSide  | Enum      | left \| right; used when split                                       |
| showEventType   | Boolean   | default false; cover type line                                       |
| showEventTitle  | Boolean   | default false; cover event name                                      |
| navPlacement    | Enum      | top \| side                                                          |
| navStyle        | Enum      | line \| pill \| underline \| solid                                   |
| navAlign        | Enum      | above \| before \| below                                             |
| navName         | String    | max 80, empty uses Event title                                       |
| navBorder       | Enum      | on \| off                                                            |
| navBorderWidth  | Enum      | thin \| medium \| thick                                              |
| navBorderStyle  | Enum      | solid \| dashed \| dotted                                            |
| coverPhotoKey   | String?   | blob filename                                                        |
| createdAt       | DateTime  |                                                                      |
| updatedAt       | DateTime  |                                                                      |

### `EventSiteInclude`

| Field           | Type    | Constraints                                    |
| --------------- | ------- | ---------------------------------------------- |
| siteId          | String  | FK EventSite, cascade                          |
| eventId         | String  | FK Event, must be direct child of site.eventId |
| accessMode      | Enum    | OPEN \| INVITED_ONLY                           |
| hasOwnGuestList | Boolean | default true                                   |
| PK              |         | (siteId, eventId)                              |

### `EventSiteSection`

| Field     | Type    | Constraints                                                                                                                |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| id        | String  | cuid                                                                                                                       |
| siteId    | String  | FK EventSite                                                                                                               |
| type      | Enum    | SectionType                                                                                                                |
| enabled   | Boolean | COVER always true                                                                                                          |
| sortOrder | Int     | COVER = 0                                                                                                                  |
| payload   | Json    | catalogs + about / faq / gifts / travel / stay / dress / rsvp options. PEOPLE is style only; roster is `EventPartyMember`. |
| Unique    |         | one row per built-in type per site; CUSTOM may repeat (max 10)                                                             |

### `EventSitePhoto`

| Field     | Type    | Constraints                                                                 |
| --------- | ------- | --------------------------------------------------------------------------- |
| id        | String  | cuid                                                                        |
| siteId    | String  | FK EventSite, cascade                                                       |
| sectionId | String? | FK EventSiteSection, cascade; null = gallery                                |
| personId  | String? | legacy site-people id; party photos now live on `EventPartyMember.photoKey` |
| filename  | String  | blob name                                                                   |
| alt       | String  | max 200                                                                     |
| sortOrder | Int     |                                                                             |
| Max       |         | 24 gallery + 20 heroes + 40 person photos / site                            |

Indexes: `EventSite.slug`, `EventSite.eventId`, `EventSiteInclude.eventId`.

---

## 8. Out of Scope

| ID    | Exclusion                                    | Why                                   |
| ----- | -------------------------------------------- | ------------------------------------- |
| OS-1  | Custom domains, subdomains, customer SSL     | Azure SWA domain cap; hosting rewrite |
| OS-2  | Freeform builder, custom HTML/CSS            | Fixed kit only                        |
| OS-3  | Wedding-only schema or section names         | Generic Event site                    |
| OS-4  | Second guest list on the site                | Event owns RSVP                       |
| OS-5  | Old-slug redirects                           | Locked: 404                           |
| OS-6  | Replacing `/rsvp/:token`                     | Token links stay                      |
| OS-7  | SITE grant for Commenter/Viewer              | Host + EDITOR only                    |
| OS-8  | Mood board as public gallery                 | Separate uploads                      |
| OS-9  | Budget, checklist, planner notes on the site | Leak risk                             |
| OS-10 | New Planner role                             | Use SITE on EDITOR                    |
| OS-11 | More than one site per Event                 | FR-1                                  |
| OS-12 | Guest Clerk accounts                         | Opaque site session                   |
| OS-13 | New BFF proxy files                          | Catch-all                             |
| OS-14 | SMS / email blast of the site URL            | Share is copy-link                    |
| OS-15 | Future section types beyond the ten          | Registry allows later; not this build |

---

## Locked decisions

1. Generic Event site; wedding is a future template.
2. One site per Event; parent may include selected direct children; child may also have its own site.
3. RSVP writes to the Event guest list; sites are doors.
4. Per-child `hasOwnGuestList`; RSVP from parent or child slug.
5. Gate is whole site + per-Event visibility. Invited-only = guest list. OPEN = visible without membership.
6. Child-only guests may unlock the parent slug.
7. Empty identity → OPEN Events only.
8. Host default; add `EventSurface.SITE` on EDITOR share, default off.
9. Fixed ten-section kit; live title/date/where/schedule; `showOnSite` default false.
10. `/e/[slug]`; no custom domain; slug change 404s old path.
11. Draft / publish / unpublish / republish / delete site (Event remains).
12. Presets + pickers; no custom CSS.
13. OPEN + published → index; invited-only and drafts → noindex.
14. 24 photos; 30-day `X-Event-Site-Session`; kebab slug + reserved list.

---

## Sign-off

| Role        | Name | Date | Verdict |
| ----------- | ---- | ---- | ------- |
| Product     |      |      |         |
| Design      |      |      |         |
| Engineering |      |      |         |

Status becomes **Approved** only after sign-off. Then tests (Phase 4) and implementation (Phase 5).
