# Event access hardening (RBAC, concealment, public tokens)

| Field     | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Author    | Backend / database security (white-box audit, 2026-08-15)                                             |
| Date      | 2026-08-15                                                                                            |
| Status    | **Implemented**                                                                                       |
| Reviewers | Host-product owner                                                                                    |
| Apps      | `apps/api` (Nest + Prisma). Small type/DTO follow-ups in `apps/web`.                                  |
| HTTP      | Existing Nest paths via `proxyClient` / `backend` / `publicGet`. No new `app/api/proxy/.../route.ts`. |

---

## 1. Context

Event access already has a real trust boundary: `EventAccessService.load` (host, accepted member, or parent member + `EventSubGrant`). Surfaces are stripped on GET. Soft-deleted events 404. Cross-event IDOR on primary routes is closed.

The audit found a second, weaker layer. **Hide-from-member** (`EventChecklistConcealment`) is applied on the event checklist list and nowhere else. A concealed member with Checklist still sees the row through schedule links, comments, activity titles, mood-board-by-checklist, and can PATCH/DELETE it.

A second hole: Home personal checklist can attach to an event and create `EventChecklist` rows without Checklist edit permission.

Public token routes overshare (RSVP guest PII, event notes). Guest tokens are `cuid()`. Re-embed jobs and `isAdminCurated` are callable by any Clerk user. Onboarding can set `UserRole.ADMIN`. Uploads are world-readable. Guest invite HTML is unescaped. There is no rate limiter.

There is no chat LLM. Embedding risk is cost abuse and ranking poison, not prompt-injection takeover.

---

## 2. Functional Requirements

### Concealment as row ACL

- **FR-1.** A viewer who is concealed from a checklist row MUST NOT receive that row’s id, title, status, comments, activity summary, schedule link, or mood-board-by-checklist payload.
- **FR-2.** Host MUST always see every checklist row. Concealment MUST NOT apply to the host.
- **FR-3.** Checklist PATCH / DELETE / complete on a concealed row MUST fail with `404` (same as unknown id). MUST NOT `403` (avoids confirming the row exists).
- **FR-4.** Comments list/create/update/delete on `CHECKLIST_ITEM` MUST run the same row check. Fail `404`.
- **FR-5.** `toScheduleDto` MUST omit checklist links the viewer cannot see. The schedule block itself MUST still return.
- **FR-6.** Activity list MUST omit or redact summaries whose `subjectType` is `CHECKLIST_ITEM` and the viewer is concealed from `subjectId`. Prefer omit.
- **FR-7.** `GET` mood-board-by-checklist MUST `404` if the viewer cannot see that checklist row.
- **FR-8.** Only the **host** MAY write `hiddenFromMemberIds`. An editor PATCH that includes the field MUST `403` or ignore-and-404 consistently — **MUST `403` “Only the host can hide checklist rows”** when the caller is not host and the field is present.
- **FR-9.** Each `hiddenFromMemberIds` value MUST be an `EventMember` of this event, or (for a child event) a parent `EventMember` who has a grant on this child. Foreign ids MUST `400`.

### Home checklist ↔ event

- **FR-10.** Creating or retargeting a personal checklist item with `eventId` MUST require `access.require(clerkId, eventId, { surface: CHECKLIST, action: 'edit' })`. Viewers, commenters, and members without Checklist MUST get `404` / existing “Event not found” denial.
- **FR-11.** Completing a personal item that is already linked MUST still sync `isCompleted` to the event row only if the user can still see that event row (host, or member not concealed). If concealed, sync MUST skip the event row (personal copy may still update).

### Public RSVP and invites

- **FR-12.** `GET /rsvp/:token` MUST return only: invite id, rsvpStatus, rsvpAt, plusOneName, dietaryNote, guestMessage, guest `{ firstName, lastName, plusOneAllowed }`, event `{ id, title, eventType, estimatedDate, location }`. MUST NOT return guest email, phone, host note, tableNumber, or `event.notes`.
- **FR-13.** New guest invite tokens MUST be `randomBytes(32)` hex or base64url. Existing `cuid()` tokens MUST keep working.
- **FR-14.** After a planner invite is accepted, `GET /event-invites/:token` MUST return `{ accepted: true, event: { title } }` only — no role, surfaces, or inviter.

### Admin and inspiration

- **FR-15.** `POST /inspiration/re-embed` and `POST /inspiration/re-embed-vendors` MUST require `User.role === ADMIN`. Others `404`.
- **FR-16.** `CreateInspirationDto` MUST NOT accept `isAdminCurated`. Create MUST store `false`.
- **FR-17.** `completeOnboarding` MUST accept role `USER` or `VENDOR` only. `ADMIN` MUST `400`. Existing admins are unchanged.
- **FR-18.** Embedding input MUST be prefixed (`Query:` for search, `Document:` for stored text). Field concatenation unchanged otherwise.

### Uploads, email, members, rate limit

- **FR-19.** Budget receipt files MUST NOT be served by public `ServeStaticModule`. Download MUST go through an authenticated event+budget route that checks BUDGET view.
- **FR-20.** Vendor / public marketplace images MAY stay on `/uploads` but new filenames MUST be crypto-random (not `Date.now()` + `Math.random()`).
- **FR-21.** Guest invite email HTML MUST run `escapeHtml` on eventTitle, guestName, location, customNote, eventDate (same helper as planner invites).
- **FR-22.** `GET /events/:id/members` MUST include `childGrants` only for the host. Non-host members MUST receive `childGrants: []` on every row (they already know their own grants via `viewer` / child access).
- **FR-23.** Public token and search routes MUST be rate-limited: `/rsvp/:token`, `/event-invites/:token`, `GET /inspiration` when `q` is present. Default 20 req / 60s / IP.

---

## 3. Non-Functional Requirements

- **NFR-1.** No new BFF proxy route files. Catch-all continues to forward.
- **NFR-2.** Browser HTTP stays axios helpers (`proxyClient`, `backend`, `publicGet`).
- **NFR-3.** Concealment check MUST be one function (`assertCanSeeChecklistItem` / `canSeeChecklistRow`) used by all FR-1–FR-7 call sites. No second concealment list.
- **NFR-4.** Fail closed: unknown or concealed checklist id → `404` “Event not found” or existing item-not-found copy. Do not confirm existence.
- **NFR-5.** UsersModule MUST NOT import EventsModule (circular). Extract `EventAccessModule` if UsersService needs `require()`.
- **NFR-6.** Jest: extend `event-access.service.spec.ts`; add focused specs for concealment helper, RSVP projection, onboarding role, and re-embed admin gate.

---

## 4. Acceptance Criteria

- **AC-1.** (FR-1, FR-5) Given a member concealed from task T, when they GET the event, then T is absent from `checklist` and from every `schedule[].checklistItems`.
- **AC-2.** (FR-3) Given that member is an EDITOR, when they PATCH T, then `404` and T is unchanged.
- **AC-3.** (FR-4) Given that member, when they GET comments for T, then `404`.
- **AC-4.** (FR-6) Given activity “Completed T”, when the concealed member lists activity, then that row is absent.
- **AC-5.** (FR-7) Given mood-board-by-checklist T, when the concealed member calls it, then `404`.
- **AC-6.** (FR-8) Given an EDITOR, when they PATCH `hiddenFromMemberIds`, then `403`.
- **AC-7.** (FR-10) Given a Schedule-only member, when they POST personal checklist with that `eventId`, then denial and no `EventChecklist` row.
- **AC-8.** (FR-12) Given a valid RSVP token, when GET `/rsvp/:token`, then the JSON has no `email`, `phone`, or `event.notes`.
- **AC-9.** (FR-15) Given a USER JWT, when POST `/inspiration/re-embed`, then `404`.
- **AC-10.** (FR-17) Given onboarding `{ role: "ADMIN" }`, then `400` and role is unchanged.
- **AC-11.** (FR-19) Given a receipt URL, when fetched without a BUDGET-capable session, then not 200 file bytes.
- **AC-12.** (FR-22) Given a non-host viewer, when they GET members, then every `childGrants` is `[]`.
- **AC-13.** (FR-14) Given an accepted planner token, when they GET `/event-invites/:token`, then body has `accepted: true` and no `surfaces`.

---

## 5. Edge Cases

- **EC-1.** Concealed assignee: host cannot hide a row from its assignee (`assertAssignee` already). Keep that.
- **EC-2.** Child event concealment uses parent `memberId` (grant path). Row check MUST use `access.memberId`, not a child-only membership.
- **EC-3.** Soft-deleted event: unchanged 404 on all gated paths.
- **EC-4.** Old RSVP `cuid()` tokens still resolve after FR-13.
- **EC-5.** Re-embed when Azure unset: ADMIN still gets `{ skipped: true }` (today’s behavior).
- **EC-6.** Personal checklist complete while concealed: personal row updates; event row does not.
- **EC-7.** Host lists members: `childGrants` still populated (People UI).

---

## 6. API Contracts

```ts
// GET /rsvp/:token  (public)
type PublicRsvp = {
  id: string
  rsvpStatus: string
  rsvpAt: string | null
  plusOneName: string | null
  dietaryNote: string | null
  guestMessage: string | null
  guest: { firstName: string; lastName: string | null; plusOneAllowed: boolean }
  event: {
    id: string
    title: string
    eventType: string
    estimatedDate: string | null
    location: string | null
  }
}

// GET /event-invites/:token  (public)
type InvitePreview =
  | {
      accepted: false
      event: { title: string; eventType: string; estimatedDate: string | null }
      invitedBy: { firstName: string | null; lastName: string | null }
      role: string
      surfaces: string[]
    }
  | { accepted: true; event: { title: string } }

// GET /events/:id/budget/:itemId/receipts/:receiptId/file  (auth, BUDGET view)
// 200 application/pdf|image; 404 otherwise
```

Errors: `{ statusCode: 400 | 403 | 404; message: string }`

---

## 7. Data Models

No new tables. `GuestInvite.token` stays `String @unique`; default generation moves to the service (Prisma `@default(cuid())` MAY remain for leftover rows; new writes set token explicitly).

`User.role` ADMIN is assigned only out of band (DB / future admin tool), never onboarding.

---

## 8. Out of Scope

| ID   | Exclusion                                       | Why                             |
| ---- | ----------------------------------------------- | ------------------------------- |
| OS-1 | Chat LLM / prompt-injection filters             | No generative model in app      |
| OS-2 | Cloud IAM, Clerk tenant MFA, TLS/headers audit  | Infra, not this code pass       |
| OS-3 | Migrating existing guest tokens                 | Old links must keep working     |
| OS-4 | Moving vendor images off `/uploads`             | Marketplace is public by design |
| OS-5 | Changing surface/role matrix (EDITOR vs VIEWER) | Already correct                 |
| OS-6 | New itinerary / proxy routes                    | Unrelated                       |
| OS-7 | Dependency CVE sweep                            | Separate pass                   |

---

## Locked decisions

1. Concealment is a third axis: surface × role × row. Fail 404.
2. Only host writes hide lists.
3. Home → event link requires Checklist **edit**.
4. RSVP public DTO is name + plus-one + public event fields.
5. Admin = `User.role === ADMIN`. Onboarding cannot mint it.
6. Receipts authenticated; other uploads stay public with stronger names.
7. Rate limit public token/search routes only (not the whole API in this pass).
