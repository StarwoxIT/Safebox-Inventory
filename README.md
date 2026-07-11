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
│   └── scripts/        One-off scripts (e.g. migrate-inventory.js)
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

See `backend/.env.example` and `frontend/.env.example`. Notably, `backend/.env` controls the company profile embedded in generated PDFs (`COMPANY_NAME`, `COMPANY_ADDRESS_LINES`, `COMPANY_EMAIL`, `COMPANY_PHONE`, `COMPANY_REG_NUMBER`, `COMPANY_BRAND_COLOR`) and `JWT_SECRET` (must be changed for production).

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

If you're consolidating an existing standalone inventory deployment into this portal, use `backend/scripts/migrate-inventory.js` — see the comments at the top of that file for field-mapping notes (role names, project status/business model remapping, the kVA→kWp unit caveat). Always run it with `--dry-run` first against a **fresh, unseeded** database before importing for real.
