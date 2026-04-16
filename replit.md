# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
This is the Flash Net (فلاش نت) network management app for an ISP business.

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

### 2 User Roles
1. **Supervisor** (`supervisor`) — Dashboard, repair-ticket (create+tabs), installation-tickets, purchase-request, database (hotspot/broadband), engineer-management, subscription-delivery, finance-audit, tasks, profile
2. **Tech Engineer** (`tech_engineer`) — Home (3 tabs: new/in-progress/completed tasks, call+location buttons, execution flow), profile

### Status Color System (network points)
- **Active** (`active`) — Blue (#1E88E5)
- **Active-Incomplete** (`active_incomplete`) — Yellow (#F9A825)
- **Ready** (`ready`) — Green (#43A047)
- **Empty** (`empty`) — Red (#E53935)
- **Stopped** (`stopped`) — Grey (#757575)

### Default Accounts
- Supervisor — Phone: `772424239`, Password: `123456`
- Tech Engineer — Phone: `737214609`, Password: `123456`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   ├── mobile/             # Expo React Native app
│   └── mockup-sandbox/     # Vite React UI component sandbox / preview
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

## Database Schema

The database has the following tables (in `lib/db/src/schema/`):

### From Task #4 (Supervisor/Auth/Network)
- `users` — with role enum (owner/finance_manager/supervisor/tech_engineer), HMAC-SHA256 auth
- `hotspot_points` — with status enum (active/active_incomplete/ready/empty/stopped)
- `broadband_points` — same status enum
- `sales_points` (network) — sales locations with managerId, ownerName, phoneNumber, oldDebt
- `card_inventory` — card stock
- `cash_box` — cash balance
- `sales_transactions` — income/expense records
- `expenses` — expense records
- `debts` — money owed to company
- `loans` — company loans
- `custodies` — custody items
- `purchase_requests` — purchase approval workflow
- `tasks` (tickets) — with status/priority enums
- `tickets` — repair/installation/support tickets

### From Task #2 (Owner Dashboard/Data Import)
- `hotspot_cards` & `broadband_cards` — Card inventory tables (serial, denomination, batchNumber, status)
- `custody_records` — Owner-to-staff custody transfers (cash or cards with auto-calculated value)
- `tasks` — Owner-assigned tasks to team members
- `financial_transactions` — Financial ledger (ALL cash movements: sales, expenses, custody_in, custody_out, collect, loan_payment, opening balance)

## Financial System Architecture (Radical/Ledger Approach)

### cash_box table
Used as a cache/secondary store for backward compatibility. Updated atomically alongside financial_transactions.

### financial_transactions: Source of Truth
`cashBalance` in `GET /finances/summary` is computed purely from the ledger:
```sql
cashBalance = SUM(
  CASE
    WHEN type IN ('sale','custody_in') AND payment_type IN ('cash','collect','opening') THEN +amount
    WHEN type = 'expense' AND payment_type IN ('cash','loan_payment') THEN -amount
    ELSE 0
  END
) FROM financial_transactions
```

### Operations Logged to financial_transactions
| Operation | type | payment_type | cash_effect |
|-----------|------|-------------|-------------|
| بيع نقدي | sale | cash | +amount |
| بيع بسلفة | sale | loan | 0 |
| صرف نقدي | expense | cash | -amount |
| صرف كدين | expense | debt | 0 |
| عهدة نقد من المالك | custody_in | cash | +amount |
| تحصيل سلفة | sale | collect | +amount |
| سداد دين | expense | loan_payment | -amount |
| نقد من مندوب | sale | cash | +amount |
| رصيد افتتاحي | custody_in | opening | +amount |

### Atomicity (DB Transactions)
All multi-step financial operations use `db.transaction()`:
- POST /transactions/sell (financial_tx + cash_box)
- POST /transactions/disburse (loan + financial_tx + expense + cash_box)
- POST /transactions/collect (debt/loan update + financial_tx + cash_box)
- POST /custody (custody_record + financial_tx + cash_box)
- POST /custody/receive (custody_record + financial_tx + cash_box)

### From Task #5 (Tech Engineer / Finance Sales Points)
- `field_tasks` — Field engineer task lifecycle (new → in_progress → completed) with taskType, serviceNumber, clientName, location, phoneNumber, notes, photoUrl
- `sales_point_loans` — Per-sales-point loan records (direction: given/received)

## Card Denomination Prices

Approved pricing table (CARD_PRICES constant in `lib/db/src/schema/cards.ts`):
- 200 SAR → 180 SAR
- 300 SAR → 270 SAR
- 500 SAR → 450 SAR
- 1000 SAR → 900 SAR
- 2000 SAR → 1800 SAR
- 3000 SAR → 2700 SAR
- 5000 SAR → 5000 SAR
- 9000 SAR → 9000 SAR

## API Routes

All routes mounted at `/api`. See `lib/api-spec/openapi.yaml` for full spec.

### Auth & Users (Task #4)
- `POST /api/auth/login` — Login with phone/password, returns bearer token
- `GET /api/auth/me` — Get current user
- `GET/POST /api/users` — List/create users
- `GET/PUT /api/users/:id` — Get/update user
- `POST /api/users/:id/toggle-active` — Toggle user active status

### Network (Task #4)
- `GET /api/network/hotspot-points` — List hotspot network points
- `GET /api/network/broadband-points` — List broadband network points
- `GET /api/network/sales-points` — List sales points

### Owner Dashboard (Task #2)
- `GET /api/healthz` — health check
- `GET /api/dashboard/summary` — owner dashboard metrics
- `GET /api/card-prices` — card denomination price table
- `POST /api/custody` — add custody (cash or cards) to a team member
- `GET /api/custody` — list custody records
- `POST /api/tasks` — assign a task to a team member
- `GET /api/tasks` — list tasks (filterable by targetRole)
- `GET /api/finances/report` — financial report by period (day/week/month/custom)
- `POST /api/import/hotspot` — bulk import hotspot cards (979 records)
- `POST /api/import/broadband` — bulk import broadband cards (632 records)
- `POST /api/import/sales-points` — bulk import sales points (56 records)

### Field Engineer Tasks (Task #5)
- `GET/POST /api/field-tasks` — list/create field engineer tasks
- `GET/PATCH /api/field-tasks/:id` — get/update field task
- `POST /api/field-tasks/:id/start` — move to in_progress
- `POST /api/field-tasks/:id/complete` — move to completed with notes/photo

### Sales Points Management (Task #5)
- `GET/POST /api/sales-points` — list/create sales points
- `GET/PATCH /api/sales-points/:id` — get/update sales point
- `GET/POST /api/sales-points/:id/loans` — list/add loans per sales point

## Features

### Tech Engineer Interface (`TechEngineerHome` mockup)
- Mobile-first task management screen for field engineers
- Header: "المهندس الفني - [name]", role, current date
- 3 quick-count cards: New Tasks / In Progress / Completed Today
- Tabbed task list (New / In Progress / Completed), default tab is New
- Task cards: task type badge, service number, client name, location, phone with Call button, Copy Location button
- "بدء التنفيذ" (Start Execution) moves task to In Progress
- "تم الإنجاز" (Done) opens modal for notes + photo upload, then moves to Completed
- No financial data shown to engineers

### Sales Points Management (`SalesPointsList` mockup, Finance Manager)
- List view of all sales points with name, owner, phone, location
- Old debt shown as informational badge — never changes through system actions
- Search/filter by name or location
- Add new sales point (with old debt as initial reference field)
- Edit existing sales points (name, owner, phone, location, notes — NOT old debt)
- Per-point loan management: view/add loans with direction (given/received) and net balance summary
- Old debt is distinct from loan tracking system

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers
  - `src/routes/health.ts` — `GET /api/healthz`
  - `src/routes/auth.ts` — `POST /api/auth/login`, `GET /api/auth/me`
  - `src/routes/users.ts` — `GET/POST /api/users`, `GET/PUT /api/users/:id`, `POST /api/users/:id/toggle-active`
  - `src/routes/network.ts` — `GET /api/network/hotspot-points`, broadband, sales
  - `src/routes/dashboard.ts` — `GET /api/dashboard/summary`, `GET /api/card-prices`
  - `src/routes/custody.ts` — `POST/GET /api/custody`, `POST /api/custody/send`, `POST /api/custody/receive`, `GET /api/custody/agents`, `GET /api/custody/summary`
  - `src/routes/tasks.ts` — `POST/GET /api/tasks` (owner-assigned tasks)
  - `src/routes/finances.ts` — `GET /api/finances/report`
  - `src/routes/import.ts` — `POST /api/import/hotspot|broadband|sales-points`
  - `src/routes/fieldTasks.ts` — `GET/POST /api/field-tasks`, lifecycle routes
  - `src/routes/salesPoints.ts` — `GET/POST /api/sales-points`, loans routes
- Auth: `src/lib/auth.ts` — HMAC-SHA256 based token auth, `requireAuth`/`requireRole` middleware
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/mobile` (`@workspace/mobile`)

Expo React Native mobile app with Arabic RTL layout.

- `app/_layout.tsx` — Root layout with AuthProvider, RTL forced
- `app/index.tsx` — Auth-based role router (redirects to role-specific tabs)
- `app/login.tsx` — Login screen (phone + password)
- `app/(owner)/` — Owner tab layout: dashboard (with live API data, add custody, add task modals), network, team, report, profile
- `app/(finance)/` — Stack layout: dashboard, sell, disburse, collect, custody, sales, expenses, debts-loans, sales-points, profile
- `app/(supervisor)/` — Stack layout: dashboard, repair-ticket, installation-tickets, purchase-request, database, tasks, engineer-management, subscription-delivery, finance-audit, profile
- `app/(tech)/` — Stack layout: home (tasks with New/In Progress/Completed tabs, call/copy buttons), profile
- `context/AuthContext.tsx` — Auth state with AsyncStorage persistence
- `context/ThemeContext.tsx` — Light/Dark theme system: `useColors()` returns current ThemeColors; `useTheme()` returns `{ isDark, colors, toggleTheme }`; persists via AsyncStorage key `flash_net_theme`; only Owner can toggle theme
- `constants/colors.ts` — Exports `DarkColors`, `LightColors`, `ThemeColors` type, `Colors` (alias for DarkColors); static `Colors` export still used by module-level constants; themed screens use `useColors()` hook
- `components/StatusBadge.tsx` — Network point status badge
- `components/RoleBadge.tsx` — User role badge

### Theme System Pattern
Themed screens use this pattern:
```tsx
import { useColors } from "@/context/ThemeContext";
import type { ThemeColors } from "@/constants/colors";
function makeScreenStyles(C: ThemeColors) { return StyleSheet.create({ container: { backgroundColor: C.background }, ... }); }
export default function MyScreen() {
  const Colors = useColors();
  const styles = useMemo(() => makeScreenStyles(Colors), [Colors]);
  ...
}
```
Sub-components defined outside the parent also use `const Colors = useColors(); const styles = useMemo(...)`.

**Fully themed screens**: login, owner/index, tech/index (+ sub-components RepairCard/InstallCard/SummaryPill/RelaySubCard), finance/index, supervisor/index

**Remaining screens** (use static `import { Colors }` — dark-only for now): all sub-screens in finance/, supervisor/, owner/ folders

### `artifacts/mockup-sandbox` (`@workspace/mockup-sandbox`)

React + Vite mockup component gallery. Components in `src/components/mockups/` are accessible at `/__mockup/preview/<ComponentName>`.

Current mockup components:
- `OwnerDashboard` — Owner home with cash balance, summary cards, add custody/task flows, financial reports, data import
- `SupervisorDashboard` — Home screen with subscription indicator, info cards, 3-section button layout, recent tasks, owner tasks, purchase requests
- `RepairTicket` — Repair ticket creation with service number lookup, auto-detection, manual entry, description, photo, engineer assignment
- `InstallationTickets` — 4-view ticket system (New/In Progress/Archived/Completed) with creation for Hotspot Internal/External/Broadband; archive review flow
- `PurchaseRequests` — Purchase request system with priority, status tracking; appears in Finance Manager view
- `DatabaseManagement` — Hotspot (sorted numerically) and Broadband tabs with add/search/view/edit; color-coded status system
- `EngineerManagement` — Add/edit/deactivate engineers; subscription delivery to Finance Manager; Finance Manager audit system
- `TechEngineerHome` — Mobile-first RTL task interface for field engineers; tabbed (New/In Progress/Completed); Start/Done workflow
- `SalesPointsList` — Finance Manager sales points with search, add/edit, per-point loans dialog

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- Schema files: `users.ts`, `network_points.ts`, `financial.ts`, `tasks_tickets.ts`, `cards.ts`, `custody.ts`, `tasks.ts` (fieldTasksTable), `loans.ts` (salesPointLoansTable)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Run schema push: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `artifacts/mockup-sandbox` (`@workspace/mockup-sandbox`)

React 19 + Vite + Tailwind CSS 4 component preview server. Used for prototyping UI screens.

- Components live in `src/components/mockups/` — auto-discovered by `mockupPreviewPlugin.ts`
- Access previews at `/__mockup/preview/<ComponentPath>` (e.g. `/__mockup/preview/finance/FinanceDashboard`)
- Full shadcn/ui component library in `src/components/ui/`
- Finance Manager Interface screens in `src/components/mockups/finance/`:
  - `FinanceDashboard.tsx` — main dashboard with KPI cards and action buttons
  - `SellScreen.tsx` — sell cards/broadband with cash or loan payment
  - `DisburseScreen.tsx` — expense recording with type/payment selection and invoice photo
  - `CollectScreen.tsx` — collect loans (receivable) and pay debts (payable)
  - `CustodyScreen.tsx` — send/receive custody management
  - `ManageSalesScreen.tsx` — custody history and sales point management
  - `SalesScreen.tsx` — sales log with period filters and summaries
  - `ExpensesScreen.tsx` — expenses log with edit/delete, templates, and obligations management
  - `DebtsLoansScreen.tsx` — loans/debts overview with sort and search
  - `data.ts` — mock data and types for all finance screens

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
