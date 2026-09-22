# Djanora remote MCP connector

| Field     | Value                                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Author    | Product + engineering (grill-me, 2026-09-20)                                                                                                                   |
| Date      | 2026-09-20                                                                                                                                                     |
| Status    | **Approved** — 2026-09-20. Implementation may proceed.                                                                                                         |
| Reviewers | Host-product owner, engineering                                                                                                                                |
| Apps      | `apps/api` (Nest + Prisma). Optional settings copy in `apps/web`. No new `apps/mcp`.                                                                           |
| Protocol  | MCP over HTTPS (Streamable HTTP). OAuth 2.1 + PKCE. Clerk identity. Bearer JWT on the resource.                                                                |
| HTTP      | MCP is a Nest transport, not a website wrapper. Existing services + `EventAccessService` only. No `fetch()` in `apps/web`. No new dedicated proxy route files. |
| Source    | Grill-me lock (Q1–Q18). Not generated from OpenAPI (none exists; 1:1 REST tools are rejected).                                                                 |

Grill-me locks are **binding** here:

| #   | Lock                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Remote MCP. User signs in with Clerk. Claude (and any remote-MCP client) connects to their Djanora account. |
| 2   | Whoever is logged in: host and vendor.                                                                      |
| 3   | Both tool sets on one server. No forced mode switch. Start from `User.activeMode`.                          |
| 4   | Job tools only. No raw HTTP / path / verb escape hatch.                                                     |
| 5   | Every website **data** outcome. Pixel editors (crop, drag, spatial mood board) stay in the app.             |
| 6   | Cheap writes run. Irreversible or public writes need a confirm.                                             |
| 7   | Sticky current event plus per-call override (id or unique title).                                           |
| 8   | Confirm = preview + short-lived `confirm_token`. Chat “yes” is not enough.                                  |
| 9   | Files in: party, cover, gallery, receipts. Same MIME and size as the API. Crop/drag stay in the app.        |
| 10  | Same grants as the website (`EventSurface` + role). MCP is not a back door.                                 |
| 11  | Inbox on demand: list, open, mark read. No SSE / live stream.                                               |
| 12  | Full vendor path: search, inspect, save, inquire, book. Inquire and book confirm.                           |
| 13  | Collaborators: invite, change surfaces, remove. Invite and remove confirm.                                  |
| 14  | Any signed-in user may connect. No plan gate. No host-only v1.                                              |
| 15  | Current event is per **connector session**. New chat / new device starts unset.                             |
| 16  | Server lives in `apps/api`. Same process, same guards, same services.                                       |
| 17  | Paste-a-URL and Claude’s connector directory both work. Same server.                                        |
| 18  | Any remote-MCP client (Claude, Cursor, ChatGPT, next). Directory is one front door. The URL is the product. |

---

## 1. Context

Djanora planning already lives behind Clerk and Nest: events, checklist, schedule, party, guests, budget, site, vendors, inquiries, notifications, inspiration, share. The only first-party client is `apps/web`. Hosts and vendors who live in Claude (or another assistant) cannot operate that account without a browser.

This spec adds a **second client**: a remote MCP resource on the existing API. The assistant is not a new principal. It is the signed-in user, with the same `EventAccessService` checks the website uses. Tools are **jobs** (“add a guest”, “publish the site”), not a dump of REST paths.

There is no OpenAPI spec and this feature MUST NOT invent one as the tool source. An OpenAPI→MCP generator would violate lock 4.

Azure already hosts Nest (`deploy-api.yml`). The connector URL is that API origin plus a fixed MCP path. Clerk already verifies Bearer JWTs (`ClerkAuthGuard`). OAuth is how a third-party MCP client obtains that JWT. Nest does not become a second identity provider.

---

## 2. Functional Requirements

### Transport and install

- **FR-1.** Nest MUST expose a remote MCP endpoint over HTTPS using the current MCP Streamable HTTP transport. Path MUST be `/mcp` (JSON-RPC on that path, plus whatever session/GET the chosen SDK requires). The origin MUST be the public API origin (same host as `/api/*`).
- **FR-2.** The same endpoint MUST work as (a) a URL the user pastes into any remote-MCP client and (b) the URL submitted to Claude’s connector directory. Directory listing MUST NOT require a second server or a second tool catalog.
- **FR-3.** Unauthenticated MCP requests MUST fail with the OAuth challenge the client expects (401 + resource-metadata / `WWW-Authenticate` per MCP OAuth). They MUST NOT run tools.
- **FR-4.** `apps/web` Settings MUST show the connector URL and a one-line “Sign in with your Djanora account” note so a host can paste it without reading this spec. That page MUST NOT call `fetch()`. If it needs Nest, it uses existing axios helpers. No new `app/api/proxy/**/route.ts`.

### Auth and identity

- **FR-5.** The user MUST sign in with Clerk. The MCP client MUST use OAuth 2.1 with PKCE. After consent, the resource MUST receive a Clerk-verifiable Bearer access token. `ClerkAuthGuard` (or the same `verifyToken` path) MUST map `payload.sub` to the existing `User` the same way HTTP controllers do.
- **FR-6.** Clerk is the identity provider. Nest MAY host only the MCP resource-metadata and token-consumption side. If a given MCP client requires authorization-server metadata or dynamic client registration that Clerk does not serve, Nest MAY add a thin OAuth adapter that still redirects the human to Clerk and still ends in a Clerk JWT. Nest MUST NOT issue a parallel password, API-key, or personal-access-token login as the v1 path.
- **FR-7.** Token expiry, revocation, and sign-out MUST follow Clerk. A revoked session MUST fail the next tool call `401`. MCP MUST NOT keep a write capability after Clerk says the session is dead.
- **FR-8.** The actor is always the signed-in user. There is no “Claude service account” and no tool that impersonates another user.

### Who and which tools

- **FR-9.** Any `User` who can complete Clerk sign-in MUST be able to connect. Free or paid, `USER` or `VENDOR`. `ADMIN` uses the same catalog; admin-only HTTP jobs (inspiration re-embed) MUST NOT appear as MCP tools.
- **FR-10.** Host tools and vendor tools MUST both be advertised on the same server. The client MUST NOT be forced to reconnect or pick a “mode” to see the other set.
- **FR-11.** `who_am_i` MUST return `{ user, activeMode, role, vendorProfile?, currentEvent?, surfacesOnCurrentEvent? }`. Claude SHOULD prefer jobs that match `activeMode`. Calling a vendor job as a host-only user (or the reverse) MUST fail the same way the website does, not hide the tool.
- **FR-12.** `set_active_mode` MUST call the existing `PATCH /users/me/mode` service. It is a cheap write.

### Job tools, not HTTP

- **FR-13.** Every MCP tool MUST be a named job with a purpose-built input schema. Tools MUST call existing Nest services. They MUST NOT accept `{ method, path, body }` or equivalent.
- **FR-14.** Tool names MUST be stable `snake_case`. Renames are breaking; add a new name and keep the old one until a later spec says otherwise.
- **FR-15.** A tool MUST NOT return raw HTML, storage keys, Clerk secrets, or guest emails on public-site projections. Editor tools MAY return the same fields the matching authenticated HTTP handler already returns to the website.
- **FR-16.** List tools MUST be pageable (`limit` default 20, max 50, `cursor` when the service already pages). They MUST be compact: ids, titles, dates, statuses — not full nested graphs unless the job is `get_*`.

### Current event

- **FR-17.** Each MCP connector **session** (SDK session id, bound to the authenticated user) MAY store at most one `currentEventId`. A new session MUST start with `currentEventId` unset. Sessions MUST NOT share current event across devices or chats.
- **FR-18.** Mutating and event-scoped read tools MUST accept optional `event_id` and optional `event_title`. Resolution order: explicit `event_id` → unique `event_title` match among events the user can see → session `currentEventId`. If none resolve, the tool MUST refuse and return `list_events`-shaped options (id, title, date). It MUST NOT guess.
- **FR-19.** `event_title` that matches more than one visible event MUST refuse and list the matches. Match is case-insensitive trim. It MUST NOT substring-match into a different wedding.
- **FR-20.** `set_current_event` MUST resolve as FR-18 and persist on this session only. `clear_current_event` MUST unset it. Successful event-scoped jobs SHOULD leave `currentEventId` set to the event they used (so the session becomes sticky after the first explicit pick).
- **FR-21.** Session current-event and confirm tokens MUST be durable enough to survive more than one Nest instance (Prisma or other shared store). Process memory alone is not enough.

### Authorization (same as the website)

- **FR-22.** Every event-scoped tool MUST go through `EventAccessService` with the same `surface` + `action` the matching HTTP handler uses. Host implied SITE. Concealment, soft-delete 404, and “Event not found” fail-closed behavior MUST match `docs/specs/event-access-hardening.md`.
- **FR-23.** A member without `GUESTS` MUST NOT read or write guests via MCP. Same for `CHECKLIST`, `SCHEDULE`, `BUDGET`, `PARTY`, `VENDORS`, `MOODBOARD`, `SITE`. Viewer / commenter / editor rules MUST match the website.
- **FR-24.** MCP MUST NOT grant host powers to a member. Invite / surface / remove collaborator tools MUST use the same host-or-allowed-editor rules as `events.controller` member routes.

### Writes and confirms

- **FR-25.** Cheap writes MUST execute on the first valid call: checklist, schedule, party fields, guest field edits, budget lines, site **draft** PATCH (catalogs, copy, enable/disable sections), comments, personal checklist, `update_me`, `set_active_mode`, save/favorite vendor, mood-board add/remove (non-spatial), notification mark-read.
- **FR-26.** The following jobs MUST be two-step. First call (no valid `confirm_token`, or `dry_run` / omitted token) MUST NOT mutate. It MUST return a preview `{ summary, blast_radius, confirm_token, expires_at }` and refuse the write. Second call MUST send that `confirm_token` and the **same** arguments. Token mismatch MUST refuse `invalid`. Expiry MUST refuse `expired`. Reuse MUST refuse `already_done` and MUST NOT mutate a second time.

  Confirm-gated jobs:

  | Job                             | Why                        |
  | ------------------------------- | -------------------------- |
  | Publish site                    | Public URL goes live       |
  | Unpublish site                  | Public URL dies            |
  | Delete site                     | Content + slug gone        |
  | Delete event                    | Cascade                    |
  | Send guest invite / bulk invite | Email leaves the building  |
  | Inquire (contact vendor)        | Message to a real business |
  | Book                            | Commitment                 |
  | Invite collaborator             | Access grant               |
  | Remove collaborator             | Access revoke              |
  | Leave event                     | Member drops off           |

- **FR-27.** `confirm_token` MUST be unguessable (`randomBytes` ≥ 32), single-use, bound to `{ sessionId, userId, toolName, payloadHash }`, TTL **10 minutes**. A token from session A MUST fail on session B. A token for `publish_site` MUST fail on `delete_event`.
- **FR-28.** Preview `blast_radius` MUST name who will see or receive the side effect in plain language (e.g. public slug, invitee emails **already on the guest row**, vendor business name). It MUST NOT invent recipients.

### Outcomes (catalog)

- **FR-29.** The tool catalog MUST cover every **data** outcome the signed-in website already supports for that user, including: events (CRUD, children), checklist, schedule, party (including photos), guests (including import and invites), budget (including receipts), comments, activity, unread, members, site editor (create, draft configure, photos, publish/unpublish/delete), notifications, inspiration search/save/like and mood-board membership, vendor search/inspect/favorite, inquiries and booking, vendor profile and posts, personal checklists, `who_am_i` / `update_me` / onboarding-complete if the HTTP route exists for that user.
- **FR-30.** Pixel-level editors MUST NOT be tools: image crop, site drag-reorder-by-pointer, mood-board spatial layout, custom CSS, arbitrary class strings. Reorder that the API already accepts as an explicit list (`sortOrder`, `children/reorder`) MUST be a job.
- **FR-31.** Site look MUST accept the same catalogs as `docs/specs/event-website.md` FR-22. Unknown catalog values MUST `400` the same as HTTP.
- **FR-32.** Guest-facing public site session and RSVP-as-anonymous-guest MUST NOT be MCP tools. The signed-in host/editor still configures the site and reads RSVP state through authenticated guest tools.

### Files

- **FR-33.** Upload jobs MUST accept at least one of: (a) MCP file / blob bytes from the client, (b) base64 + MIME, (c) an existing media id or public upload URL the user already has on this account. The service MUST run the same MIME and size checks as the matching HTTP upload (site/party: jpeg/png/webp, 8 MB; receipts: existing budget receipt rules).
- **FR-34.** Upload jobs MUST use existing `BlobStorageService` / public-upload helpers. Tool results MUST return public URLs, never storage keys (event-website FR-24).
- **FR-35.** Crop, focal point, and drag placement MUST NOT be MCP inputs. The stored image is the bytes received.

### Inbox and vendors

- **FR-36.** `list_notifications`, `get_notification`, `mark_notification_read`, `mark_notifications_read` MUST call `NotificationsService`. No MCP SSE, no `EventSource`, no long-poll tool.
- **FR-37.** Host vendor jobs: search, get vendor, favorite/unfavorite, create inquiry (confirm), accept/reject quote if the HTTP route exists for that user, book (confirm), read/send inquiry messages. Vendor-side jobs: `vendors/me`, posts + media, vendor inquiry inbox, status, messages. Same DTOs and status machines as HTTP.

### Collaborators

- **FR-38.** `list_members`, `invite_member` (confirm), `update_member` (role/surfaces; confirm if the change **adds** SITE or upgrades role to EDITOR), `remove_member` (confirm), `leave_event` (confirm), `list_pending_invites`, `accept_invite` (cheap; the user already opened the invite). Surfaces MUST accept the same enum as HTTP, including `SITE` (grant only). Viewer/Commenter + SITE MUST `400` as event-website FR-9.

### Errors

- **FR-39.** Tool errors MUST be structured: `{ code, message, details? }` where `code` is `unauthorized` | `not_found` | `forbidden` | `invalid` | `conflict` | `needs_confirm` | `needs_event` | `rate_limited` | `unavailable`. Soft-hidden events and concealed checklist rows MUST use `not_found` with the same public copy as HTTP (“Event not found”), not `forbidden`.
- **FR-40.** `needs_confirm` is the only success-shaped refusal that includes `confirm_token`. `needs_event` MUST include the visible event list.

---

## 3. Non-Functional Requirements

- **NFR-1.** No new `apps/mcp` package and no Cloudflare/worker hop in v1.
- **NFR-2.** No new `app/api/proxy/**/route.ts`. Browser HTTP stays axios helpers.
- **NFR-3.** MCP auth MUST NOT reuse `EVENT_SITE_SESSION_SECRET`. Guest site HMAC and connector sessions are different secrets. If Nest stores session rows, the table is not the guest site cookie.
- **NFR-4.** Confirm tokens and session current-event MUST work on a multi-instance API (shared DB). TTL: confirm 10 minutes; session idle **24 hours** or Clerk token expiry, whichever is first.
- **NFR-5.** Tool handler p95 < 800 ms excluding blob I/O, for list/get/cheap writes on an event with ≤ 200 guests. Upload and vendor search inherit existing HTTP budgets.
- **NFR-6.** Throttle MCP: 60 tool calls / 60 s / user on cheap reads/writes; 10 / 60 s / user on confirm-gated jobs and uploads. Exceed → `rate_limited`.
- **NFR-7.** Jest: OAuth-missing → no tools; confirm preview does not mutate; confirm token reuse fails; session A token fails on session B; member without GUESTS cannot `list_guests`; `event_title` ambiguity refuses; new session has no current event; vendor book without token does not book; concealment 404 on checklist get.
- **NFR-8.** Accessibility: protocol has no UI (N/A). Settings URL copy MUST meet `docs/standards/accessibility.md` (labeled control, copy button with accessible name).
- **NFR-9.** Logs MUST record `userId`, `toolName`, `eventId?`, `confirm: issued|spent|rejected`, never Bearer tokens or confirm token raw values (hash prefix only).
- **NFR-10.** Additive tool evolution only. Shipping a new job is a spec amendment. Do not silently widen a confirm-gated job into a cheap write.

---

## 4. Acceptance Criteria

- **AC-1.** (FR-3, FR-5) Given no Bearer token, when a client calls a tool, then no service write runs and the response is `unauthorized` / OAuth challenge.
- **AC-2.** (FR-5, FR-8) Given user A’s token, when a tool names user B’s event id, then `not_found` and B’s data is unchanged.
- **AC-3.** (FR-10, FR-11) Given a user with `activeMode=host` and a vendor profile, when the client lists tools, then both host and vendor jobs are present. `who_am_i.activeMode` is `host`.
- **AC-4.** (FR-12) Given `activeMode=host`, when `set_active_mode({ mode: "vendor" })`, then `who_am_i.activeMode` is `vendor` (same as `PATCH /users/me/mode`).
- **AC-5.** (FR-13) Given a tool schema, when the client sends `{ method: "POST", path: "/events" }`, then the job rejects `invalid`. No HTTP proxy tool exists.
- **AC-6.** (FR-17, FR-18) Given a new session and a user with two events, when `add_checklist_item` omits event, then `needs_event` and no row is created.
- **AC-7.** (FR-19, FR-20) Given two events titled “Reception”, when `set_current_event({ event_title: "Reception" })`, then refuse + both ids. When called with a unique id, then later `add_checklist_item` without event writes to that id.
- **AC-8.** (FR-17) Given session 1 set to Event X, when session 2 starts for the same user, then session 2 has no current event.
- **AC-9.** (FR-22, FR-23) Given an EDITOR with only `CHECKLIST`, when they `list_guests` or `publish_site`, then `not_found` / denial matching HTTP and no mutation.
- **AC-10.** (FR-25) Given checklist edit grant, when `add_checklist_item` is called once, then the row exists (no token).
- **AC-11.** (FR-26, FR-27) Given SITE grant, when `publish_site` is called without a token, then the site stays `DRAFT` and the result is `needs_confirm` with a token. When the same args + token are sent, then status is `PUBLISHED`.
- **AC-12.** (FR-27) Given a spent or expired token, when `publish_site` is called again, then no status change and `invalid` / `needs_confirm`.
- **AC-13.** (FR-27) Given a token issued for `publish_site` on Event X, when it is sent to `delete_event` or Event Y, then no mutation.
- **AC-14.** (FR-33, FR-34) Given a jpeg under 8 MB, when `set_party_photo` runs, then GET party returns a public URL and no storage key.
- **AC-15.** (FR-33) Given a 9 MB file or `image/gif`, when any image upload job runs, then `invalid` and no blob row.
- **AC-16.** (FR-36) Given two unread notifications, when `list_notifications` then `mark_notification_read`, then one remains unread. No stream tool exists.
- **AC-17.** (FR-26, FR-37) Given a vendor slug, when `inquire_vendor` runs without a token, then no inquiry row. With token, then the inquiry exists as in HTTP.
- **AC-18.** (FR-26, FR-38) Given host, when `invite_member` without token, then no member row and no email. With token, then the same result as `POST /events/:id/members`.
- **AC-19.** (FR-9, FR-14) Given a free host and a paid vendor account, both can complete OAuth and call `who_am_i`.
- **AC-20.** (FR-2, FR-1) Given the public `/mcp` URL, when Claude custom connector and a second MCP client both OAuth, then both receive the same tool names.
- **AC-21.** (FR-32) Given only a published site slug, when the MCP catalog is listed, then no `event_site_session` / anonymous RSVP tool exists.
- **AC-22.** (NFR-6) Given 61 cheap calls in 60 s from one user, then the 61st is `rate_limited`.
- **AC-23.** (FR-21, NFR-4) Given confirm issued on API instance A, when spent on instance B within TTL with the same session, then the write runs once.
- **AC-24.** (FR-6, FR-7) Given Clerk revocation, when the next tool runs, then `unauthorized` and no write.

---

## 5. Edge Cases

- **EC-1.** Clerk down during OAuth → client sees IdP error; Nest MUST NOT mint a local session.
- **EC-2.** Clerk up, DB down → tools `unavailable`; no partial writes.
- **EC-3.** Blob store down on upload → `unavailable`; event/site row unchanged (event-website EC-9).
- **EC-4.** Session row expires mid-confirm → token `invalid`; user re-previews.
- **EC-5.** Two previews of `publish_site` → two tokens; spending one publishes once; the other MUST fail as spent/superseded (implementation MUST invalidate outstanding tokens for the same `{ sessionId, toolName, payloadHash }` when one is spent).
- **EC-6.** `event_title` empty or whitespace → treat as omitted.
- **EC-7.** Soft-deleted current event still on the session → next job behaves as unset (`needs_event`).
- **EC-8.** User loses SITE grant after preview, before confirm → confirm MUST fail `not_found`; site stays draft.
- **EC-9.** Duplicate guest import via MCP → same as HTTP import (no second invent).
- **EC-10.** Inquire/book on a vendor the user cannot see → `not_found`.
- **EC-11.** `invite_member` email already on the event → same `409`/`invalid` as HTTP; first call still does not send mail without confirm.
- **EC-12.** Client retries the confirm spend twice (network) → second is reuse; write happened once (idempotent spend).
- **EC-13.** MCP client that cannot do OAuth 2.1 → out of support; do not add a paste-an-API-key bypass in v1.
- **EC-14.** Tool argument includes extra unknown fields → reject `invalid` (no silent ignore of `confirm_token` typos).
- **EC-15.** `activeMode=vendor` but `who_am_i` has no vendor profile → vendor write jobs fail as HTTP (`404`/`400`); host jobs still work if the user has events.

---

## 6. API Contracts

MCP tools are the contract. REST paths below are **implementation targets** (existing Nest handlers/services), not tools.

Errors (tool result `isError` or structured content):

```ts
type McpErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'forbidden'
  | 'invalid'
  | 'conflict'
  | 'already_done'
  | 'expired'
  | 'needs_confirm'
  | 'needs_event'
  | 'rate_limited'
  | 'unavailable'

type McpError = {
  code: McpErrorCode
  message: string
  details?: unknown
}

type EventRef = { id: string; title: string; estimatedDate: string | null }

type NeedsEvent = McpError & {
  code: 'needs_event'
  details: { events: EventRef[] }
}

type ConfirmPreview = {
  code: 'needs_confirm'
  summary: string
  blast_radius: string
  confirm_token: string
  expires_at: string // ISO
}

type Page<T> = { items: T[]; nextCursor: string | null }
```

Common event args on event-scoped tools:

```ts
type EventScope = {
  event_id?: string
  event_title?: string
  confirm_token?: string
}
```

### Session and account

| Tool                  | In                             | Out                      | Confirm | Service                        |
| --------------------- | ------------------------------ | ------------------------ | ------- | ------------------------------ |
| `who_am_i`            | —                              | FR-11                    | no      | `UsersService.ensureFromClerk` |
| `set_active_mode`     | `{ mode: "host" \| "vendor" }` | `{ activeMode }`         | no      | `setMode`                      |
| `update_me`           | existing `UpdateMeDto` fields  | user                     | no      | `updateMe`                     |
| `complete_onboarding` | existing DTO                   | user                     | no      | `completeOnboarding`           |
| `list_events`         | `{ cursor?, limit? }`          | `Page<EventRef>`         | no      | `EventsService` list           |
| `get_event`           | `EventScope`                   | event + `viewer`         | no      | `GET /events/:id`              |
| `set_current_event`   | `{ event_id? , event_title? }` | `{ currentEvent }`       | no      | session store                  |
| `clear_current_event` | —                              | `{ currentEvent: null }` | no      | session store                  |

### Planning jobs (cheap unless noted)

Each job’s mutate fields MUST match the existing DTO for that HTTP route. Do not invent parallel field names.

| Tool                                                                                                                             | HTTP / service        | Confirm |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------- |
| `create_event`                                                                                                                   | `POST /events`        | no      |
| `update_event`                                                                                                                   | `PATCH /events/:id`   | no      |
| `delete_event`                                                                                                                   | `DELETE /events/:id`  | **yes** |
| `add_child_event` / `attach_child_event` / `detach_child_event` / `reorder_children`                                             | children routes       | no      |
| `list_checklist` / `add_checklist_item` / `update_checklist_item` / `delete_checklist_item`                                      | checklist routes      | no      |
| `list_schedule` / `add_schedule_item` / `update_schedule_item` / `delete_schedule_item`                                          | schedule routes       | no      |
| `list_party` / `add_party_member` / `update_party_member` / `delete_party_member` / `pair_party_members` / `unpair_party_member` | party routes          | no      |
| `set_party_photo` / `clear_party_photo`                                                                                          | party photo routes    | no      |
| `list_guests` / `add_guest` / `update_guest` / `delete_guest` / `import_guests`                                                  | guests routes         | no      |
| `invite_guest` / `bulk_invite_guests`                                                                                            | invite routes         | **yes** |
| `list_budget` / `add_budget_item` / `update_budget_item` / `delete_budget_item` / `import_budget`                                | budget routes         | no      |
| `add_budget_receipt` / `get_budget_receipt` / `delete_budget_receipt`                                                            | receipt routes        | no      |
| `list_comments` / `add_comment` / `update_comment` / `delete_comment`                                                            | comments              | no      |
| `list_activity`                                                                                                                  | activity              | no      |
| `get_unread` / `mark_unread`                                                                                                     | unread                | no      |
| `list_personal_checklists` / `add_personal_checklist` / `update_personal_checklist` / `delete_personal_checklist`                | `users/me/checklists` | no      |

### Site (editor)

| Tool                                                      | HTTP                     | Confirm |
| --------------------------------------------------------- | ------------------------ | ------- |
| `get_site`                                                | `GET /events/:id/site`   | no      |
| `create_site`                                             | `POST /events/:id/site`  | no      |
| `update_site`                                             | `PATCH /events/:id/site` | no      |
| `publish_site`                                            | `POST .../publish`       | **yes** |
| `unpublish_site`                                          | `POST .../unpublish`     | **yes** |
| `delete_site`                                             | `DELETE .../site`        | **yes** |
| `set_site_cover` / `add_site_photo` / `delete_site_photo` | cover/photos             | no      |
| `set_section_photo` / `clear_section_photo`               | section photo            | no      |
| `set_site_person_photo` / `clear_site_person_photo`       | site person photo        | no      |

### Share

| Tool                  | HTTP                                 | Confirm                                 |
| --------------------- | ------------------------------------ | --------------------------------------- |
| `list_members`        | `GET /events/:id/members`            | no                                      |
| `invite_member`       | `POST /events/:id/members`           | **yes**                                 |
| `update_member`       | `PATCH .../members/:memberId`        | **yes** if role↑ or SITE added; else no |
| `remove_member`       | `DELETE .../members/:memberId`       | **yes**                                 |
| `leave_event`         | `POST /events/:id/leave`             | **yes**                                 |
| `list_event_invites`  | `GET /events/invites`                | no                                      |
| `accept_event_invite` | `POST /events/invites/:token/accept` | no                                      |

### Vendors, inquiries, inbox, inspiration

| Tool                                                                                                                             | HTTP                                 | Confirm                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| `search_vendors` / `get_vendor`                                                                                                  | `GET /vendors`, `GET /vendors/:slug` | no                                                                |
| `favorite_vendor` / `unfavorite_vendor` / `list_favorite_vendors`                                                                | favorite routes                      | no                                                                |
| `inquire_vendor`                                                                                                                 | `POST /inquiries`                    | **yes**                                                           |
| `list_inquiries` / `get_inquiry` / `list_inquiry_messages` / `send_inquiry_message`                                              | inquiries                            | no                                                                |
| `accept_quote` / `reject_quote`                                                                                                  | quote routes                         | **yes**                                                           |
| `book_vendor`                                                                                                                    | `POST /inquiries/:id/book`           | **yes**                                                           |
| `list_vendor_inquiries` / `set_inquiry_status`                                                                                   | vendor inquiry                       | no (status) / **yes** if status is a terminal decline that emails |
| `get_vendor_me` / `update_vendor_me` / `create_vendor_profile`                                                                   | `vendors/me`                         | no                                                                |
| `list_vendor_posts` / `create_vendor_post` / `update_vendor_post` / `delete_vendor_post`                                         | posts                                | no                                                                |
| `add_vendor_post_media`                                                                                                          | post media                           | no                                                                |
| `list_notifications` / `get_notification` / `mark_notification_read` / `mark_notifications_read`                                 | notifications                        | no                                                                |
| `search_inspiration` / `get_inspiration` / `save_inspiration` / `unsave_inspiration` / `like_inspiration` / `unlike_inspiration` | inspiration                          | no                                                                |
| `list_mood_board` / `add_mood_board_item` / `remove_mood_board_item`                                                             | mood-board membership                | no                                                                |

`GET /inspiration/re-embed*` MUST NOT have tools.

### OAuth / HTTP (non-tool)

```
GET  /.well-known/oauth-protected-resource   → resource metadata (MCP URL, auth server)
GET  /.well-known/oauth-authorization-server → Clerk or Nest adapter (FR-6)
POST /mcp                                    → Streamable HTTP MCP (authed tools)
GET  /mcp                                    → session/stream as required by the SDK
```

Existing Clerk-guarded REST stays as-is for `apps/web`. MCP MUST NOT be the only way to do a job the website already does.

---

## 7. Data Models

No change to `Event`, `EventMember`, `EventSurface`, guests, site, inquiries, or notifications schemas beyond what those features already have.

### `McpSession`

| Field          | Type     | Constraints                      |
| -------------- | -------- | -------------------------------- |
| id             | String   | PK; MCP session id               |
| userId         | String   | FK User, cascade                 |
| clerkId        | String   | `User.clerkId` at create (audit) |
| currentEventId | String?  | FK Event, `onDelete SetNull`     |
| createdAt      | DateTime |                                  |
| lastUsedAt     | DateTime | bump on each tool; idle TTL 24h  |

Unique: `id`. Index: `(userId, lastUsedAt)`.

### `McpConfirmToken`

| Field       | Type      | Constraints                                    |
| ----------- | --------- | ---------------------------------------------- |
| id          | String    | cuid PK                                        |
| tokenHash   | String    | unique; hash of raw token (raw never stored)   |
| sessionId   | String    | FK McpSession, cascade                         |
| userId      | String    | FK User                                        |
| toolName    | String    |                                                |
| payloadHash | String    | canonical JSON of job args excluding the token |
| expiresAt   | DateTime  | create + 10 minutes                            |
| spentAt     | DateTime? | set on successful spend                        |
| createdAt   | DateTime  |                                                |

Index: `(sessionId, toolName, spentAt)`.

Prisma migrations MUST live under `apps/api/prisma/migrations/`.

---

## 8. Out of Scope

- **OS-1.** Pixel editors: crop, drag, spatial mood board, custom CSS, arbitrary classes. Reason: lock 5.
- **OS-2.** Raw HTTP tool / OpenAPI-generated 1:1 tools. Reason: lock 4. (mcp-server-builder OpenAPI workflow does not apply until a later spec says otherwise.)
- **OS-3.** Live notification stream, SSE, or MCP subscriptions for inbox. Reason: lock 11.
- **OS-4.** Privilege escalation, service accounts, “act as host”. Reason: locks 8–10.
- **OS-5.** Guest-as-guest MCP (public site session, anonymous RSVP). Reason: connector is a signed-in user.
- **OS-6.** Personal access tokens, API keys, or paste-a-secret instead of Clerk OAuth. Reason: lock 1 / FR-6.
- **OS-7.** Separate `apps/mcp` or edge worker. Reason: lock 16.
- **OS-8.** Plan-gated connector or host-only v1. Reason: lock 14.
- **OS-9.** Admin curation / re-embed / webhook management via MCP.
- **OS-10.** New payment rails. `book_vendor` uses existing inquiry book only.
- **OS-11.** Custom domains, new public guest pages, or changing event-website visibility rules.
- **OS-12.** Teaching Claude to operate the **website DOM**. MCP talks to Nest, not the Next app.
- **OS-13.** Changing `ClerkAuthGuard` semantics for existing REST (except shared verify used by MCP).
- **OS-14.** Implementation / coding in the same change as this Draft spec.

---

## 9. Open implementation notes (not product forks)

These are allowed without a new grill-me, as long as they satisfy FR-5/FR-6:

1. Which official MCP TypeScript SDK Nest mounts (`@modelcontextprotocol/sdk` Streamable HTTP).
2. Whether Clerk’s native MCP/OAuth app covers dynamic client registration, or Nest serves a thin adapter that still redirects to Clerk.
3. Canonical JSON for `payloadHash` (sorted keys, no `confirm_token`).
4. Exact Settings UI copy for the connector URL.

If Clerk cannot produce a JWT `ClerkAuthGuard` already accepts, **stop** and amend this spec. Do not invent a second user table.

---

## Approval

Approved 2026-09-20 (product: cook). Implementation may proceed from this file.
