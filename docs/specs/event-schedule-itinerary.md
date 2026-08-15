# Event schedule: parent itinerary and child day timeline

| Field | Value |
|---|---|
| Author | Product + engineering (locked grill, 2026-08-15) |
| Date | 2026-08-15 |
| Status | **Implemented** |
| Reviewers | Host-product owner |
| Apps | `apps/api` (Nest + Prisma), `apps/web` (Next.js App Router) |
| HTTP | Browser calls `proxyClient` → `/api/proxy/*` → Nest. No `fetch()` in `apps/web`. No new dedicated proxy route files. |

---

## 1. Context

Schedule today is a **single-day run of clock times**. `EventScheduleItem` has `startTime` / `endTime` as `HH:MM` and no date. The UI label is **Day-of schedule**. That assumes one `Event` is one calendar day.

Events are no longer one day. A top-level event can hold sub-events (`Event.parentId`) spread across weeks: bride price, court, traditional, reception. Each child is a full event with its own date and its own Schedule tab.

The host needs two views:

1. **Parent Schedule** — a multi-day itinerary: days, optional times, and each visible child as one beat on that child’s date.
2. **Child Schedule** — the hour-by-hour for that one ceremony. Times only. The child’s `estimatedDate` is the day.

This spec does not add a Wedding type, does not unroll a child’s blocks onto the parent, and does not pin a parent block to a child.

---

## 2. Functional Requirements

### Modes

- **FR-1.** An event with `parentId = null` (top-level) MUST use **itinerary** mode for Schedule, even if it has zero children.
- **FR-2.** An event with `parentId` set (sub-event) MUST use **day** mode for Schedule: times only. The system MUST treat that event’s `estimatedDate` as the day for those blocks.
- **FR-3.** The nav tab MUST stay **Schedule** in both modes. The parent header MUST NOT say “Day-of schedule.”

### Parent itinerary composition

- **FR-4.** The parent itinerary MUST be a **composed view**, not a second stored copy of children. It MUST show:
  1. **Authored blocks** — `EventScheduleItem` rows on the parent.
  2. **Child beats** — one row per **visible** live child (`deletedAt` null).
- **FR-5.** A child beat MUST NOT be persisted as an `EventScheduleItem`. Adding, dating, renaming, or removing a child MUST change the itinerary through the child event itself.
- **FR-6.** The host MUST NOT be able to delete or detach a child beat from Schedule. Those actions stay on the sub-event list (remove / delete / change date).
- **FR-7.** Activating a child beat MUST navigate to that child’s event page (`/events/:childId`).
- **FR-8.** A child beat MUST display at least: child title, type label, date if present, location if present. It MUST look distinct from an authored block (it is an event, not a timed note).

### When (authored blocks)

- **FR-9.** On a top-level event, creating an authored block MUST require a **date** (`YYYY-MM-DD`). Time (`startTime` / `endTime`) MUST remain optional. The block MUST NOT accept a “pin to child” field.
- **FR-10.** On a sub-event, creating or updating a block MUST NOT require or store a date. Existing time validation (`HH:MM`) MUST stay. Sending a date on a child schedule endpoint MUST fail with `400`.
- **FR-11.** Updating a parent authored block MUST allow changing date and times. Clearing the date MUST fail with `400` (new parent blocks stay dated). Migration-only undated rows are the exception in FR-18.

### Grouping and order

- **FR-12.** The parent itinerary MUST group rows by date, chronological. The last group MUST be **Undated** when any undated child beat or undated authored block exists.
- **FR-13.** A child with no `estimatedDate` MUST appear in **Undated**, not on an invented day. When the host sets that child’s date, the beat MUST move to that day.
- **FR-14.** Within one date, order MUST be:
  1. Child beats for that date (journey order: `estimatedDate`, then `sortOrder`, then `createdAt`).
  2. Authored blocks with a start time, by `startTime` ascending.
  3. Authored blocks with no start time, by `sortOrder` then `createdAt`.
- **FR-15.** Undated group order MUST be: undated child beats (journey order), then undated authored blocks (`sortOrder`, `createdAt`).

### Visibility

- **FR-16.** A child beat MUST appear only if the current viewer can open that child (same rule as today’s child access: host of the parent, or an accepted parent membership **and** a sub-grant on that child). No grant → omit the beat. The itinerary MUST NOT use a placeholder that reveals a hidden child.
- **FR-17.** Authored parent blocks follow today’s Schedule surface: no `SCHEDULE` on the parent → no Schedule tab / `403` on schedule endpoints, as today. Child beats still omit per FR-16 even when the viewer has Schedule on the parent.

### Migration

- **FR-18.** On deploy, every existing `EventScheduleItem` on a **top-level** event that has `date` null MUST be backfilled: if that event has `estimatedDate`, set `date` to that calendar day (`YYYY-MM-DD` in the event’s date key). If the event has no `estimatedDate`, leave `date` null so the block lands in Undated (FR-12).
- **FR-19.** Existing items on **sub-events** MUST keep `date` null. No backfill.

### Child day timeline

- **FR-20.** Sub-event Schedule MUST keep today’s create / edit / delete / links (budget, checklist, inspiration). Blocks MUST NOT appear on the parent itinerary (no unroll).
- **FR-21.** Empty copy on a child MUST describe a day timeline (times on this event’s date), not a multi-day itinerary.

### Links

- **FR-22.** Budget, checklist, and inspiration links MUST remain on **authored** `EventScheduleItem` rows only. A child beat MUST NOT carry those links. The child’s own schedule holds that ceremony’s links.

---

## 3. Non-Functional Requirements

- **NFR-1.** Schedule mutations MUST stay on existing paths: `GET|POST /events/:id/schedule`, `PATCH|DELETE /events/:id/schedule/:itemId`. The catch-all BFF MUST keep forwarding them. No new `app/api/proxy/.../route.ts`.
- **NFR-2.** Browser HTTP MUST use `proxyClient`. No `fetch()` in `apps/web`.
- **NFR-3.** Child-beat visibility MUST be enforced from the same access data as `projectTree` (host or grant). The UI MUST NOT invent a second visibility list.
- **NFR-4.** Backfill (FR-18) MUST be a one-shot Prisma migration or SQL in that migration. It MUST be idempotent if re-run (only fill `date` where null on top-level items).
- **NFR-5.** Composing the itinerary for a parent with ≤ 50 children and ≤ 200 authored blocks MUST happen in the request that already loads the event (no extra list round-trip required).

---

## 4. Acceptance Criteria

- **AC-1.** (FR-1, FR-9) Given a top-level event with no children, when the host adds a block with date `2026-09-12` and no time, then the block appears under that date on Schedule.
- **AC-2.** (FR-1, FR-9) Given a top-level event, when the host submits a block with no date, then the API returns `400` and no row is created.
- **AC-3.** (FR-2, FR-10) Given a sub-event, when the host adds a block with `startTime` `14:30` and no date, then the block is saved and shown on that child’s Schedule in time order.
- **AC-4.** (FR-2, FR-10) Given a sub-event, when the client sends `date` on create or update, then the API returns `400`.
- **AC-5.** (FR-4, FR-5, FR-8) Given a parent with a child dated `2026-09-04` titled Court, when the host opens parent Schedule, then Court appears once as a beat on Sep 4 and there is no matching `EventScheduleItem` for that beat.
- **AC-6.** (FR-5, FR-13) Given that Court beat, when the host changes Court’s `estimatedDate` to `2026-09-05`, then parent Schedule shows Court on Sep 5 and not on Sep 4.
- **AC-7.** (FR-6) Given a child beat on parent Schedule, when the host looks for delete on that beat, then there is no delete control that removes the child or the beat.
- **AC-8.** (FR-7) Given a child beat, when the host activates it, then the app navigates to `/events/:childId`.
- **AC-9.** (FR-12, FR-13) Given a child with no date, when the host opens parent Schedule, then that child is in Undated at the bottom.
- **AC-10.** (FR-16) Given a member who can open the parent but has no grant on Court, when they open parent Schedule, then Court is absent and no gap/placeholder names Court.
- **AC-11.** (FR-16) Given the parent host, when they open parent Schedule, then every live child they own appears (dated or Undated).
- **AC-12.** (FR-18) Given a top-level event dated `2026-09-12` with a pre-change block `14:00` and `date` null, when the migration runs, then that block’s `date` is `2026-09-12` and it appears on that day.
- **AC-13.** (FR-18) Given a top-level event with no `estimatedDate` and a pre-change block, when the migration runs, then `date` stays null and the block appears in Undated.
- **AC-14.** (FR-20) Given Court has three timed blocks, when the host opens the **parent** Schedule, then those three blocks are not listed; only the Court beat is.
- **AC-15.** (FR-3) Given a parent Schedule header, when rendered, then the label is not “Day-of schedule.”
- **AC-16.** (FR-14) Given Sep 12 has child Traditional (no time) and authored “Doors” at 18:00, when the itinerary renders that day, then Traditional is above Doors.

---

## 5. Edge Cases

- **EC-1.** Child soft-deleted (`deletedAt` set) MUST disappear from the itinerary immediately.
- **EC-2.** Two children on the same date MUST both show as beats that day, in journey order (FR-14).
- **EC-3.** Parent `estimatedDate` is not a schedule group by itself. A parent date with no blocks and no children on that day MUST NOT render an empty day heading.
- **EC-4.** Detaching a child MUST remove its beat from the old parent and MUST NOT copy its day blocks onto the parent.
- **EC-5.** Attaching an existing event MUST add a beat on that event’s date (or Undated).
- **EC-6.** Viewer has Schedule on the parent but not on a visible child: the beat still shows (it is the child event, not that child’s schedule surface). Opening the child follows existing tab rules.
- **EC-7.** `endTime` without `startTime` on a parent block: allowed as today; sort as no start time (FR-14.3).
- **EC-8.** Invalid date string on a parent block MUST `400`.
- **EC-9.** Timezone: dates are calendar keys (`YYYY-MM-DD`), same as `event-timing` (`en-CA` date key). MUST NOT shift a day via UTC midnight.

---

## 6. API Contracts

Existing routes. Body gains optional `date`.

```ts
// POST /events/:id/schedule
// PATCH /events/:id/schedule/:itemId
type ScheduleItemWrite = {
  title: string
  notes?: string | null
  date?: string | null        // YYYY-MM-DD; REQUIRED on create when :id is top-level
  startTime?: string | null   // HH:MM
  endTime?: string | null
  location?: string
  budgetItemIds?: string[]
  checklistItemIds?: string[]
  inspirationItemIds?: string[]
  sortOrder?: number          // PATCH only
}

// GET /events/:id/schedule and Event.schedule on GET /events/:id
type EventScheduleItem = {
  id: string
  title: string
  notes: string | null
  date: string | null         // always null on sub-event items
  startTime: string | null
  endTime: string | null
  location: string | null
  sortOrder: number
  budgetItems: { id: string; label: string | null; vendorName: string | null; category: string; allocatedAmount: number }[]
  checklistItems: { id: string; title: string; isCompleted: boolean }[]
}

type ApiError = { statusCode: 400 | 403 | 404; message: string }
```

| Call | Top-level `:id` | Sub-event `:id` |
|---|---|---|
| POST without `date` | `400` | `201` (date ignored / rejected if sent) |
| POST with `date` | `201` | `400` |
| PATCH `date: null` | `400` | `400` if date sent |
| DELETE authored item | `200` as today | `200` as today |
| DELETE child beat | N/A — not an item | N/A |

Itinerary composition MAY happen in `apps/web` from `event.schedule` + `event.children` already returned by `GET /events/:id`. Children on that payload MUST already be grant-filtered (`projectTree`). MUST NOT add `GET /events/:id/itinerary`.

---

## 7. Data Models

### `EventScheduleItem` (add column)

| Field | Type | Constraints |
|---|---|---|
| `date` | `String?` | `YYYY-MM-DD` or null. `@map("date")` `@db.VarChar(10)` |

Existing columns unchanged: `title`, `notes`, `startTime`, `endTime`, `location`, `sortOrder`, links.

### Child beat (not a table)

Derived from a visible child `Event`: `id`, `title`, `eventType`, `estimatedDate`, `location`, `sortOrder`, `isCompleted`.

### Migration

1. Add nullable `date`.
2. Backfill per FR-18 / FR-19.
3. No check constraint that forces date on all rows (Undated leftovers and all child rows stay null).

---

## 8. Out of Scope

| ID | Exclusion | Why |
|---|---|---|
| OS-1 | Unroll child’s timed blocks onto the parent | Locked: one beat per child |
| OS-2 | Pin a parent authored block to a child | Locked: date + optional time only |
| OS-3 | `Event` start/end time fields | Child beat is date-level; times live on the child schedule |
| OS-4 | A sub-event that itself spans multiple calendar days | One `estimatedDate` per child; split into another sub-event if needed |
| OS-5 | New itinerary endpoint or proxy route | Compose from existing event payload |
| OS-6 | Calendar export, ICS, reminders | Not in this grill |
| OS-7 | Reordering child beats independently of journey `sortOrder` | Journey remains source of child order |
| OS-8 | Showing hidden children as locked placeholders | Fail closed (FR-16) |
| OS-9 | Changing budget / sharing / My Events list | Unrelated |

---

## Locked grill (trace)

1. Parent Schedule = itinerary; child Schedule = day timeline.
2. Children auto-include as beats.
3. One beat, not an unroll.
4. Parent extras = date + optional time, not pinned to a child.
5. Undated at the bottom.
6. Top-level is dated from the start (zero children still itinerary).
7. No grant on a child → no beat.
8. Old parent blocks take the event date when it exists, else Undated.
