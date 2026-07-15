# Safebox Portal

A production-grade portal unifying **inventory management**, **quotation management**, and **payment management** for Safebox Energy: track products and stock, quote solar projects with multiple pricing options, and manage payment collection across Full Payment, Installments, and Pay as you Go (EaaS) plans.

## Tech Stack

- **Frontend:** React 18 (Vite), React Router DOM, Recharts, Tabler Icons
- **Backend:** Node.js 18+, Express, SQLite (better-sqlite3), JWT auth, bcryptjs, uuid, Puppeteer (PDF)
- **Infra:** Docker, Docker Compose, Nginx reverse proxy, GitHub Actions CI/CD, AWS EC2

## Project Structure

```
safebox-portal/
├── backend/            Express API + SQLite + PDF generation
│   └── scripts/        One-off scripts (migrate-inventory.js, migrate-schema-in-place.js)
├── frontend/           React (Vite) admin UI
├── nginx/              Reverse proxy (routes /api -> backend, / -> frontend)
├── docker-compose.yml  Production stack
├── docker-compose.dev.yml
├── scripts/            setup.sh, dev.sh, build.sh, deploy.sh, backup.sh, logs.sh
└── .github/workflows/  CI/CD pipeline
```

## Running Locally (without Docker)

```bash
./scripts/setup.sh          # installs backend + frontend deps, creates .env files

# terminal 1
cd backend && npm run dev   # http://localhost:4000

# terminal 2
cd frontend && npm run dev  # http://localhost:5173 (proxies /api to :4000)
```

A super admin account is seeded automatically the first time the database is created:

- **Email:** `superadmin@safeboxenergy.com`
- **Password:** `SafeboxAdmin@2026`

Override these via `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `backend/.env` before the first run, and change the password immediately after logging in for production use.

## Running with Docker (development, hot reload)

```bash
./scripts/dev.sh
```

## Running with Docker (production)

```bash
./scripts/build.sh
docker-compose up -d
```

The stack is served on `http://localhost` (nginx reverse proxy → `/api` to backend, everything else to the frontend static build). Database persists in the `safebox-db` named volume.

## Deploying to AWS EC2 / a VPS

1. Provision a server with Docker + Docker Compose installed, clone this repo there.
2. Configure GitHub repository secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (private key), `EC2_PROJECT_PATH`.
3. Push to `main` — `.github/workflows/deploy.yml` builds the images and uses `appleboy/ssh-action` to pull + restart the stack on the server.
4. For manual deploys from your machine: set `EC2_HOST` (and optionally `EC2_USER`, `EC2_PATH`) and run `./scripts/deploy.sh`.

## Deploying to Netlify (frontend) + Render (backend)

Frontend and backend are deployed as separate services and talk to each other over HTTPS.

**Backend on Render (free tier):**
1. Create a Render account → **New → Blueprint** → connect the repo. Render reads [render.yaml](render.yaml:1) at the repo root automatically (Docker runtime, free plan, builds from `backend/Dockerfile`, health check on `/api/health`).
2. Render will prompt for the env vars marked `sync: false`: set `FRONTEND_URL` (your Netlify URL, once you have it), and optionally `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`. `JWT_SECRET` is auto-generated.
3. Render assigns a public URL like `https://safebox-backend.onrender.com` — that's your backend URL.

   > **Free tier limitations:** there's no persistent disk on this plan, so the SQLite database is **wiped every time the service redeploys or restarts**. Render also spins the service down after 15 minutes of inactivity. Fine for demoing, not for real client/inventory data — add a `disk` block back to `render.yaml` (mounted at `/data`) and upgrade to Starter or higher for real persistence.

**Frontend on Netlify:**
1. Create a Netlify site → "Import from GitHub" → select the repo. It reads `netlify.toml` at the repo root automatically (base `frontend/`, build `npm run build`, publish `dist/`).
2. Set a build environment variable: `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`.
3. Deploy. Netlify gives you a public URL like `https://<site>.netlify.app`.
4. Go back to Render and set `FRONTEND_URL` to that Netlify URL so CORS allows it.

Both platforms auto-redeploy on every push to `main` once connected — no GitHub Actions secrets needed for this path.

## Environment Variables

### Backend (`backend/.env` — copy from `backend/.env.example`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `4000` | Port the Express API listens on. |
| `NODE_ENV` | No | `development` | `development` or `production`. |
| `JWT_SECRET` | **Yes, in production** | placeholder value | Signs/verifies auth tokens. Must be changed to a long random value before going live — anyone who knows the placeholder value could forge tokens. |
| `DB_DIR` | No | `./data` (relative to `backend/`) | Directory holding `database.db`. Leave unset for local (non-Docker) dev. Docker Compose sets this to `/data`, mounted from the `safebox-db` named volume, so the database survives container rebuilds/redeploys. |
| `FRONTEND_URL` | No | unset (CORS allows all origins) | Comma-separated list of allowed frontend origins for CORS, e.g. your Netlify URL. Leave unset in local dev. |
| `SUPER_ADMIN_EMAIL` | No | `superadmin@safeboxenergy.com` | Email for the super admin account seeded the very first time the database is created. Has no effect on an existing, already-seeded database. |
| `SUPER_ADMIN_PASSWORD` | No | `SafeboxAdmin@2026` | Password for that same seeded account. Change it immediately after first login in any real deployment. |
| `COMPANY_BRAND_COLOR` | No | `#B7DC38` | Fixed brand accent color used in generated PDFs (logo files are static assets, not user-editable). |
| `COMPANY_BRAND_COLOR_LIGHT` | No | `#EEF7D9` | Lighter tint of the brand color, used for PDF backgrounds/highlights. |
| `CURRENCY_SYMBOL` | No | `₦` | Currency symbol used when rendering amounts in generated PDFs. |

All other company profile content — name, address, mission/vision, products list, the page-2 photo, etc. — is **not** an env var; it's stored in the `company_profile` table and edited from the Company Profile settings page in the app.

### Frontend (`frontend/.env` — copy from `frontend/.env.example`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | `/api` | Base path/URL the frontend calls for API requests. Leave as `/api` when frontend and backend are served from the same origin (nginx reverse proxy, Docker Compose). Set to the full backend URL (e.g. `https://safebox-backend.onrender.com/api`) when frontend and backend are deployed as separate services (Netlify + Render). |

No new environment variables were introduced by any of the unified-portal work (projects, payments, inventory, roles, materials/stock sync) — everything added lives in the database schema, not in config. These variables are also identical to what the previous standalone inventory app used, so an existing deployment's env configuration doesn't need to change.

## Core Concepts

### Projects (Inventory + Quotation + Execution, unified)
- **Projects** are the single entry point covering a client engagement from prospect through completion — merging what used to be separate "Job" and "Project" records.
- **Status:** `Prospect` → `Quote Accepted` → `On-going` (or `Active (EaaS)` for metered engagements) → `Completed` / `Rejected`.
- **Business Model:** `Outright Purchase`, `EaaS`, `Repair Service`, `Maintenance Service`, `Upgrade`.
- **Payment Category:** `Full Payment`, `Installments`, `Pay as you Go` — constrained by business model (`EaaS` only allows `Pay as you Go`; every other business model allows `Full Payment` or `Installments`).
- Each project can have 5-6 **quotation options** (`OPTION 1`, `OPTION 2`, ...), but **new quotation options can only be added while the project is in `Prospect` status**. Once a client's chosen option is marked selected, the project moves to `Quote Accepted` and quoting locks — only a **Super Admin** can still edit the selected option after that.
- Projects also track **materials used** (drawn from the product catalog), **engineers assigned**, and **other costs** — all rolled up into a total project cost.

### Quotations
- Each quotation option has line items (catalog-selected or custom), an internal `unit_cost` used to compute `subtotal`, and a `markup_percent` applied to reach `grand_total` (the final client-facing price).
- Every create/edit/markup change is snapshotted into `quotation_versions` for full history and re-opening past quotes.
- `GET /api/quotes/:id/pdf` renders a single option as an A4 PDF. `GET /api/projects/:id/proposal/pdf` renders a combined proposal PDF: cover page + company profile page + every quotation option for that project.

### Inventory
- **Products** carry category/subcategory/brand/model/unit/cost/reorder thresholds and go through a **Pending → Approved/Rejected** workflow: an `admin` creates a product (or logs a stock movement) as Pending; a `super_admin` approves or rejects it.
- **Stock Movements** track quantity in/out (purchases, transfers, project usage, damage, adjustments) against a product, with current stock computed from approved movements plus reconciled returns.
- **Returns** (client or project) and **Battery Collections** are tracked separately, with OEM reconciliation fields on returns.

### Payments
Once a project's quotation is selected (`status = 'quote_accepted'`), an admin creates a **Payment Plan** using the project's payment category:
- **Full Payment:** a deposit milestone (before installation) + a balance-on-completion milestone.
- **Installments:** a deposit milestone + N equal installments spread by day/week/month.
- **Pay as you Go (EaaS):** an optional small deployment deposit, then open-ended **usage billing periods** (meter readings × rate) logged and marked paid over time.

Marking a milestone or usage period as paid recognizes a **proportional share of the markup** into `income_records` (the amount paid × markup ÷ total quotation value) — this is what powers the "Confirmed Income" dashboard stat. When every milestone on a Full Payment or Installments plan is paid, the plan, quotation, and project are all automatically marked completed. EaaS plans are never auto-completed (billing is open-ended) — a Super Admin closes them out manually.

### Audit trail
Every login and every create/update/delete/select/approve/payment action across projects, quotes, products, stock movements, payments, users, and the company profile is recorded in `audit_log`, viewable at `/audit-trail` in the app (Super Admin only).

## Roles

| Role        | Permissions |
|-------------|-------------|
| Admin       | Day-to-day access: create/edit projects, add quotation options while a project is in Prospect, create products/stock movements (as Pending), log materials/engineers/costs, create payment plans and record payments |
| Super Admin | Everything Admin can do, plus: approve/reject pending products & stock movements, manage users, view the audit trail, edit the company profile, delete records, and edit a locked/selected quotation after quoting has moved past Prospect |

New users are created by a super admin via the Users page (`POST /api/auth/register`).

## Migrating data from the legacy standalone inventory system

This app's `.env` / `docker-compose` / `DB_DIR` configuration is identical to the standalone inventory app's, so pointing this app at the same database file or Docker volume works at the connection level with no config changes. Schema-wise, almost every table is either byte-for-byte identical (`products`, `categories`, `subcategories`, `units`, `returns`, `battery_collections`, `project_materials`, `project_engineers`, `project_costs`, `settings`) or brand new (`quotations`, `payment_plans`, `company_profile`, ...) — new tables are created automatically and don't touch anything already in the database.

Two tables — `users` and `projects` — had their `CHECK` constraints change (role/status enum values) and gained new columns, so they need one of two migration paths:

- **Reusing the existing database file/volume in place:** run `node backend/scripts/migrate-schema-in-place.js --dry-run` first to see a report of what it would do, then run it again without `--dry-run` to migrate for real. It takes a timestamped backup of the database file automatically before making any change, rebuilds `users`/`projects` with the new schema, and remaps existing values (`'Super Admin'` → `super_admin`, `'Planning'` → `prospect`, etc.). It's safe to run against an already-migrated database — it detects that and does nothing.
- **Importing into a fresh, unseeded database from an exported copy of the old one:** use `backend/scripts/migrate-inventory.js <path-to-old-db>` — see the comments at the top of that file for full field-mapping notes. Always run with `--dry-run` first.

### Is existing production data safe if the new app is deployed against the same database?

Yes — starting the new app doesn't delete or overwrite anything. `schema.sql` only ever uses `CREATE TABLE IF NOT EXISTS` (there is no `DROP TABLE` anywhere in the schema or migrations), and the migrations that run automatically on every boot are strictly additive/renaming — `stock_movements.condition` gets backfilled with a default value, `audit_log`'s `timestamp`/`detail` columns get renamed to `created_at`/`details` — never destructive.

One thing to be aware of: until `migrate-schema-in-place.js` (or the fresh-import path above) has been run, **existing user accounts and projects will be present but not fully functional** under the new code. Existing users can still authenticate (email/password are unaffected), but their old-format role value (`'Admin'`/`'Super Admin'`) won't match the new lowercase role checks, so they'll get "Insufficient permissions" on protected actions until migrated. Existing projects will be missing the new `business_model` / `payment_category` / `client_name` / `sector` fields the new UI expects. Everything else — products, stock movements, categories, returns, battery collections — works immediately with no migration step at all, since those tables didn't change shape. Running the migration script (a few seconds, non-destructive, backs itself up first) resolves both remaining gaps.
