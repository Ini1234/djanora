@AGENTS.md

# HTTP

Never use `fetch()` in this app. Axios only:

- Browser (logged in): `proxyClient` from `@/lib/proxy-client` → `/api/proxy/*`
- RSC (logged in): `getMe` / `serverFetch` from `@/lib/api.server`
- Public pages: `publicGet` / `backend` from `@/lib/backend`
- Route Handlers: `proxyNest` from `@/lib/proxy-nest`

Do not add new files under `app/api/proxy/` except the catch-all. New Nest paths are called with their canonical URL via `proxyClient`.
