# Saarlekha Payroll

India-first payroll management system. Full-stack monorepo: Next.js 14 frontend + NestJS backend + PostgreSQL.

## Quick Start

> **Shell note:** Commands below use **PowerShell** (Windows default). PowerShell 5.1 does **not** support `&&` for chaining — run each line separately or chain with `;`. On macOS/Linux (bash/zsh) the same commands work as-is.

### 1. Provision a PostgreSQL database

Pick **one**:

- **Docker** (local): `docker compose up postgres -d` — needs Docker Desktop installed and running. (Note: `docker compose`, not the legacy `docker-compose`.)
- **Cloud (no install):** create a free Postgres at [Neon](https://neon.tech) or [Supabase](https://supabase.com), then copy the connection string into `apps/api/.env` (see step 2).
- **Native:** install PostgreSQL 16 and point `DATABASE_URL` at it.

### 2. Setup API

```powershell
cd apps\api
Copy-Item .env.example .env
npm install
# Edit apps\api\.env and set DATABASE_URL (and DIRECT_URL — see note below)
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
npm run dev
```

**`DATABASE_URL` vs `DIRECT_URL`** — the Prisma schema declares both:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")  // pooled — runtime queries
  directUrl = env("DIRECT_URL")    // direct — migrations
}
```
- **Local Docker / native Postgres:** set both to the same connection string.
- **Neon / Supabase (pooled):** `DATABASE_URL` = the **pooled** string (host contains `-pooler`); `DIRECT_URL` = the **direct** string (same host **without** `-pooler`). Prisma Migrate requires a direct connection.

The API dev server runs via **`ts-node-dev`** (configured in `package.json`), which compiles TypeScript on the fly and resolves the `@saarlekha/shared` workspace import — no separate build step needed for local dev.

### 3. Setup Web

Run in a **separate terminal** (leave the API running):

```powershell
cd apps\web
Copy-Item .env.example .env.local
npm install
npm run dev
```

> **Required config files** (already committed — a fresh clone has them): the web app needs **`postcss.config.js`** for Tailwind to work, plus `tailwind.config.ts`. Without `postcss.config.js`, the `@tailwind` directives in `globals.css` are never processed and the UI renders as **unstyled HTML**. If you ever see an unstyled page, confirm `apps/web/postcss.config.js` exists and restart `npm run dev` (PostCSS config is read only at startup).

### URLs
- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **Swagger Docs**: http://localhost:4000/api/docs

### Demo Login
- Email: `admin@demo.com`
- Password: `password123`

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `The token '&&' is not a valid statement separator` | PowerShell 5.1 doesn't support `&&` | Run lines separately or use `;` |
| `docker-compose: command not found` | Docker not installed, or using legacy command | Install Docker Desktop; use `docker compose` (space) |
| `Cannot find module dist/main` | Running `nest start`/`node dist/main` in this monorepo | Use `npm run dev` (ts-node-dev) — already the default |
| Prisma migrate hangs/fails on Neon | Used the pooled URL for migrations | Set `DIRECT_URL` to the non-`-pooler` host |
| UI renders as unstyled HTML | Missing/!loaded `postcss.config.js` | Ensure it exists, restart `npm run dev` |
| `npm error code ENOWORKSPACES` (web) | Harmless Next.js-internal npm call | Ignore — does not affect the app |

---

## Architecture

```
saarlekha-payroll/
├── apps/
│   ├── api/               # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # JWT auth
│   │   │   │   ├── company/        # Company & dashboard
│   │   │   │   ├── employees/      # Employee management
│   │   │   │   ├── salary/         # Salary components & structures
│   │   │   │   ├── payrun/         # Payrun engine
│   │   │   │   ├── payslips/       # Payslip access
│   │   │   │   ├── leave/          # Leave management
│   │   │   │   ├── attendance/     # Attendance tracking
│   │   │   │   ├── compliance/     # PF, ESI, TDS, PT
│   │   │   │   └── reports/        # Analytics & reports
│   │   │   └── database/           # Prisma service
│   │   └── prisma/
│   │       ├── schema.prisma       # Full DB schema
│   │       └── seed.ts             # Demo data
│   └── web/               # Next.js 14 frontend
│       └── src/
│           ├── app/
│           │   ├── (auth)/         # Login, Register
│           │   └── (dashboard)/    # All dashboard pages
│           ├── components/         # Reusable UI components
│           ├── lib/api.ts          # Typed API client
│           └── stores/             # Zustand state
└── packages/
    └── shared/             # Shared TypeScript types & constants
        └── src/
            ├── types/      # Employee, Payroll, Compliance, Leave types
            └── constants.ts # India states, PT slabs, PF config
```

## Features Implemented

### Phase 1 — Foundation
- [x] Multi-company setup with PF, ESI, GST registration fields
- [x] Employee management with full KYC (PAN, Aadhaar, UAN)
- [x] Salary structure engine with formula-based components
- [x] JWT authentication with role-based access (Admin, HR, Manager, Employee)
- [x] Department hierarchy

### Phase 2 — Payroll Processing
- [x] Automated payrun engine with LOP calculation
- [x] PF calculation (EPF + EPS + EDLI) with ₹15,000 wage limit
- [x] ESI calculation with ₹21,000 wage limit
- [x] Professional Tax — 7 states configured (MH, KA, WB, TN, AP, TG, GJ)
- [x] TDS engine — Old & New regime, 80C/80D/HRA deductions
- [x] Maker-checker approval workflow (Draft → Pending → Approved → Paid; approver must differ from creator)
- [x] Off-cycle and supplementary payruns

### Phase 3 — Leave & Attendance
- [x] Leave policies (CL, SL, EL, Maternity, Paternity)
- [x] Leave application and approval workflow
- [x] Balance tracking with carry-forward rules
- [x] Attendance management with LOP auto-calculation
- [x] Holiday calendar

### Phase 4 — Reports
- [x] Salary register with department-wise breakdown
- [x] Headcount report by department
- [x] PF challan report
- [x] Compliance calendar with due dates

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/register | Register company + admin |
| GET | /api/company/dashboard | Dashboard stats |
| GET/POST | /api/employees | List / create employees |
| GET | /api/employees/:id/salary-breakdown | Salary breakdown |
| POST | /api/salary/components/seed | Seed default components |
| GET/POST | /api/salary/structures | Salary structures |
| POST | /api/payrun | Create payrun |
| POST | /api/payrun/:id/process | Run payroll calculation |
| PATCH | /api/payrun/:id/approve | Approve payrun |
| PATCH | /api/payrun/:id/mark-paid | Mark as paid |
| GET | /api/reports/salary-register | Salary register |
| GET | /api/reports/headcount | Headcount report |
| GET | /api/compliance/pf-challan | PF challan data |
| GET | /api/leave/applications | Leave requests |
| PATCH | /api/leave/applications/:id/review | Approve/reject leave |

## Environment Variables

### API (`apps/api/.env`)
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/saarlekha_payroll
JWT_SECRET=your-secret-key
PORT=4000
FRONTEND_URL=http://localhost:3000
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## Next Steps (Phase 5)

- [ ] PDF payslip generation with company letterhead
- [ ] WhatsApp payslip delivery (Twilio/Meta API)
- [ ] Form 16 PDF generation with eSign
- [ ] 24Q XML generation for TRACES filing
- [ ] Biometric device integration (ZKTeco)
- [ ] Tally / QuickBooks journal entry export
- [ ] Multi-tenant billing & subscription management
- [ ] Email notifications for payslip dispatch
- [ ] Employee mobile app (PWA)
- [ ] Data migration wizard (from Zoho/Keka/GreytHR)
