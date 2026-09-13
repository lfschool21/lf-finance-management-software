<div align="center">

# 🌸 Little Flowers Finance Tracker

**A private, all-in-one financial management system for running a school's money matters — tuition, expenses, transfers, and recoverables — in one clean dashboard.**

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white)](#-pwa-support)
[![License: Private](https://img.shields.io/badge/license-private-lightgrey)](#-license)

</div>

---

## 📖 About

**Little Flowers Finance Tracker** is a purpose-built web app for tracking the day-to-day finances of a school — tuition and lunch fee collection, staff and operational expenses, cash/bank transfers, student-wise fee ledgers, and money advanced to (and recovered from) staff or vendors.

It's designed as a single source of truth that replaces scattered spreadsheets and paper registers, while staying fast enough to use on a phone at the front desk between classes.

## ✨ Features

### 💰 Financial Core
- **Dashboard** — at-a-glance snapshot of cash position, fee collection progress, recent activity, and a cash-flow chart.
- **Income tracking** — record tuition fees, lunch fees, and other income, with automatic classification of current vs. late/old-fee collections.
- **Expense tracking** — separate school and home expense books, each with its own category set (salaries, rent, utilities, supplies, events, etc.).
- **Transfers** — move money between school bank, personal bank, and cash accounts (deposits, withdrawals, internal transfers) with a full audit trail.
- **Bank balances** — live balances per account, computed from every income, expense, transfer, and recoverable entry.
- **Recoverables** — track advances given to staff/others and log partial or full repayments until settled.
- **Recurring transactions** — set up monthly/bimonthly/quarterly recurring income or expenses, with a review flow before each one is posted.

### 🎓 Student Management
- Per-class rosters with fee status badges (paid, partial, overdue).
- Individual student pages with full payment history, current & historical fee recording, and class progression.
- Bulk **student import** from Excel/CSV via a guided import wizard.
- Global student search across the whole app.

### 📊 Reporting & Insights
- Visual reports (bar, line, and pie charts) for income vs. expenses, category breakdowns, and trends over time.
- **Export to PDF and Excel** for sharing with stakeholders or keeping offline records.
- Global search across income, expenses, transfers, and recoverables.

### 🛠️ Platform
- **Multi-language UI** — English and Gujarati (ગુજરાતી), switchable at runtime.
- **Academic year management** — define year boundaries, tuition targets, and carry-forward fees; the setup wizard walks a new school through initial accounts and years.
- **Demo mode** — try the full app instantly via anonymous sign-in, no account needed.
- **Backup & restore** — export/import your data as a safety net.
- **Installable PWA** — add it to your home screen and it runs like a native app, offline-tolerant via a service worker.
- **Row-level secured backend** — every table lives behind Supabase Auth + Postgres RLS policies, so each account only ever sees its own data.

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript, built with Vite |
| Styling / UI | Tailwind CSS, shadcn/ui (Radix primitives), lucide-react icons |
| State | Zustand stores, TanStack Query |
| Forms & validation | React Hook Form + Zod |
| Charts | Recharts |
| Documents | jsPDF (PDF export), SheetJS/`@e965/xlsx` (Excel import & export) |
| Backend | Supabase (Postgres, Auth, Row-Level Security, SQL migrations) |
| Routing | React Router v6 |
| Testing | Vitest + Testing Library (unit), Playwright (end-to-end) |
| Tooling | ESLint, TypeScript strict project references |

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm** (or `bun`, since a `bun.lock` is included)
- A **Supabase** project (free tier is fine) — for the database and auth

### 1. Clone & install
```bash
git clone <this-repo-url>
cd lf-finance-management-software
npm install
```

### 2. Configure environment variables
Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-public-key
VITE_SUPABASE_PROJECT_ID=your-supabase-project-id
```

You'll find these values in your Supabase project's **Settings → API** page.

### 3. Set up the database
Apply the SQL migrations in `supabase/migrations/` to your Supabase project — either by pasting them into the SQL editor in order, or via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Run the dev server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`. On first login, the **Setup Wizard** walks you through creating your accounts and first academic year — or just try **Demo Mode** from the login screen to explore with sample data.

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check and build for production |
| `npm run build:dev` | Build in development mode (useful for debugging a prod-like bundle) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint over the codebase |
| `npm run typecheck` | Run TypeScript project checks with no emit |
| `npm run test` | Run the Vitest unit/component test suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run the local Supabase release gate, then the Playwright end-to-end suite |

## 📂 Project Structure

```
src/
├── components/       # Shared UI components (modals, layout, ui/ primitives)
│   ├── dashboard/    # Dashboard-specific widgets & charts
│   └── students/     # Student roster, cards, tables, and modals
├── pages/            # Route-level pages (Dashboard, Income, Expenses, Reports, ...)
├── store/            # Zustand stores (finance, students, language)
├── services/         # Supabase-backed data access (income, expenses, transfers, ...)
├── lib/              # Core domain logic, i18n, backup, student import, demo mode
├── utils/            # Formatting & calculation helpers (currency, dates, class progression)
├── types/            # Shared TypeScript types for finance & student domains
└── test/             # Unit & component tests

supabase/
├── migrations/       # Ordered SQL migrations (schema, RLS policies, workflows)
├── preflight/        # Pre/post-migration safety checks for production
└── tests/            # SQL-level integrity tests

e2e/                  # Playwright end-to-end specs
```

## 🧪 Testing

- **Unit & component tests** (Vitest + Testing Library) cover domain logic like fee calculations, class progression, backup/restore, and student import — run with `npm run test`.
- **End-to-end tests** (Playwright) exercise real authenticated flows against a local Supabase instance — run with `npm run test:e2e`. This requires a `.env.test.local` with local Supabase credentials, since the release-gate script deliberately refuses to run against anything but `localhost`/`127.0.0.1`.

## 🌍 Localization

The UI currently ships with full translations for:
- 🇬🇧 English
- 🇮🇳 Gujarati (ગુજરાતી)

Language strings live in `src/lib/i18n.ts`; the active language is persisted via the language store and can be switched from Settings.

## 📱 PWA Support

The app registers a service worker and ships a web manifest, so it can be installed to a phone's home screen or a desktop and used in standalone, app-like mode.

## ☁️ Deployment

The project includes a `vercel.json` rewrite rule for single-page-app routing, so it deploys to [Vercel](https://vercel.com/) out of the box — connect the repo, set the three `VITE_SUPABASE_*` environment variables in the project settings, and deploy. Any other static host that supports SPA rewrites (Netlify, Cloudflare Pages, etc.) will work just as well.

## 🔒 License

This is a private, internal project built for Little Flowers School. All rights reserved — not licensed for external use or redistribution.

---

<div align="center">
Made with care for keeping a school's books honest and simple. 🏫
</div>
