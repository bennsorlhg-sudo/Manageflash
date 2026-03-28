# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with Expo Router

## Application: Flash Net

Flash Net is a network management system for ISPs with a mobile app (Expo) and API backend.

### 4 User Roles
1. **Owner** (`owner`) — Full access: dashboard, network, team management, profile
2. **Finance Manager** (`finance_manager`) — Financial screens, profile
3. **Supervisor** (`supervisor`) — Network monitoring, tasks, profile
4. **Tech Engineer** (`tech_engineer`) — Tickets/repairs, profile

### Status Color System (network points)
- **Active** (`active`) — Blue (#1E88E5)
- **Active-Incomplete** (`active_incomplete`) — Yellow (#F9A825)
- **Ready** (`ready`) — Green (#43A047)
- **Empty** (`empty`) — Red (#E53935)
- **Stopped** (`stopped`) — Grey (#757575)

### Default Owner Account
- Phone: `0500000000`
- Password: `admin123`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── mobile/             # Expo React Native app
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
└── ...
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `src/routes/health.ts` — `GET /api/healthz`
  - `src/routes/auth.ts` — `POST /api/auth/login`, `GET /api/auth/me`
  - `src/routes/users.ts` — `GET/POST /api/users`, `GET/PUT /api/users/:id`, `POST /api/users/:id/toggle-active`
  - `src/routes/network.ts` — `GET /api/network/hotspot-points`, `GET /api/network/broadband-points`
- Auth: `src/lib/auth.ts` — HMAC-SHA256 based token auth, `requireAuth`/`requireRole` middleware
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app with Arabic RTL layout.

- `app/_layout.tsx` — Root layout with AuthProvider, RTL forced
- `app/index.tsx` — Auth-based role router (redirects to role-specific tabs)
- `app/login.tsx` — Login screen (phone + password)
- `app/(owner)/` — Owner tab layout: dashboard, network, team, profile
- `app/(finance)/` — Finance manager tabs: finance, profile
- `app/(supervisor)/` — Supervisor tabs: network, tasks, profile
- `app/(tech)/` — Tech engineer tabs: tickets, profile
- `context/AuthContext.tsx` — Auth state with AsyncStorage persistence
- `constants/colors.ts` — Color theme + status/role color maps
- `components/StatusBadge.tsx` — Network point status badge
- `components/RoleBadge.tsx` — User role badge

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

**Schema tables:**
- `users` — with role enum (owner/finance_manager/supervisor/tech_engineer)
- `hotspot_points` — with status enum (active/active_incomplete/ready/empty/stopped)
- `broadband_points` — same status enum
- `sales_points` — sales locations
- `card_inventory` — card stock
- `cash_box` — cash balance
- `sales_transactions` — income/expense records
- `expenses` — expense records
- `debts` — money owed to company
- `loans` — company loans
- `custodies` — custody items
- `purchase_requests` — purchase approval workflow
- `tasks` — with status/priority enums
- `tickets` — repair/installation/support tickets

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Run schema push: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`).

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package.
