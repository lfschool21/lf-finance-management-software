<div align="center">

🎓 Little Flowers School Finance Management

Academic-year finance, student fees, reporting, and operational tracking in one focused web application.

<p>
  A full-stack school finance platform built with React, TypeScript, Supabase, and PostgreSQL.
  It is designed around real administrative workflows: collecting student fees, tracking prior-year dues,
  managing expenses and accounts, reconciling money movement, and turning financial data into useful reports.
</p>









</div>

✨ Overview

Little Flowers School Finance Management is a purpose-built web application for managing school finances and student fee accounts across academic years.

The project goes beyond simple income/expense CRUD. It models school-specific financial behavior such as current-year tuition, previous-year pending fees, payment allocation, English/Gujarati medium enrollment, account-to-account transfers, recurring expenses, recoverable advances, opening balances, financial reconciliation, and year-wise reporting.

The application combines a responsive React frontend with Supabase authentication, PostgreSQL persistence, Row Level Security, database validation, and transactional RPC workflows.

🚀 Key Features

📊 Financial Dashboard

Academic-year-aware financial overview

Current-year fee collection and previous-year dues

Available liquidity across configured accounts

School profit and projected year-end position

Gujarati and English medium student snapshots

Monthly income vs. school-expense visualization

Top expense-category analysis

Operational attention indicators for pending dues, recoverables, and recurring expenses

Recent financial activity across accounts

👨‍🎓 Student & Fee Management

Central student directory with class and medium organization

Separate Gujarati Medium and English Medium views

Current academic-year enrollment records

Student-level annual fee obligations and collection progress

Previous-year fee history and carried-forward pending dues

Current-year and historical fee payment workflows

Payment-method tracking including cash, UPI, bank transfer, cheque, and other methods

Automatic fee summaries: obligation, collected amount, pending amount, and collection percentage

Class-wise student organization and fee summaries

Student archival support

📥 Intelligent Student Import

The import workflow is designed for real school spreadsheets rather than a rigid single-format CSV.

Flexible column mapping

Recognizes common student, class, medium, fee, collected, and pending-fee headings

Supports opening collection history

Supports previous academic-year fee information

Detects malformed amounts and inconsistent totals

Flags possible duplicates and conflicts before import

Supports default medium and annual-fee values when appropriate

Validates current and historical fee relationships before committing data

💰 Income Management

Current-year tuition fees

Previous-year fee collections

Lunch-fee income

Other school income

Academic-year tuition targets

Account and payment-method attribution

Student-linked tuition payments

Late-collection tracking against the original academic year

🧾 Expense Management

School and home/personal expense separation

Structured expense categories

Recurring expense templates

Recurring-expense review workflow

Account-aware expense recording

Monthly and category-level expense analytics

🔁 Transfers & Account Balances

Multiple school, personal, and cash accounts

Opening balance support

Internal transfer tracking

Cash deposit and withdrawal flows

School-to-personal and personal-to-school transfer categories

Derived account balances based on the complete transaction history

Archived-account support

🤝 Recoverables

Money temporarily advanced from an account is modeled separately from normal expenses.

Track recoverable advances by party

Record partial or complete repayments

Maintain outstanding balances

Restore account liquidity on repayment without treating it as new income

📈 Reports & Exports

Monthly financial trends

Academic-year Profit & Loss view

All-time financial overview

Year-over-year comparison

Student-fee reporting

Fee summaries by class and medium

Pending-fee reports

Expense-category analytics

PDF export using jsPDF

CSV transaction export

Student-fee CSV export

🌐 English + Gujarati Interface

Global English/Gujarati language switcher

Gujarati-aware typography and readability adjustments

Persistent language preference through local storage

Translated navigation, dashboard labels, actions, finance terminology, and student workflows

🧪 Built-in Demo Workspace

The login experience includes an Explore Demo mode backed by anonymous Supabase authentication.

Creates an isolated demo workspace

Seeds realistic sample finance data

Allows the demo dataset to be reset

Keeps demo data separate from registered-user workspaces

Supports clean demo-workspace disposal

🛠️ Tech Stack

Layer

Technologies

Frontend

React 18, TypeScript, Vite

UI

Tailwind CSS, shadcn/ui, Radix UI, Lucide React, Framer Motion

Routing

React Router

State Management

Zustand

Forms & Validation

React Hook Form, Zod

Backend / Database

Supabase, PostgreSQL

Authentication

Supabase Auth

Database Security

Row Level Security (RLS), validation functions, triggers

Charts

Recharts

Spreadsheet Processing

@e965/xlsx

PDF Export

jsPDF, jsPDF AutoTable

Unit / Integration Testing

Vitest, Testing Library

End-to-End Testing

Playwright

Deployment Configuration

Vercel

🧠 Architecture

flowchart LR
    U[Admin / User] --> UI[React + TypeScript UI]
    UI --> R[React Router]
    UI --> S[Zustand Stores]
    S --> SV[Service Layer]
    SV --> SB[Supabase Client]

    SB --> A[Supabase Auth]
    SB --> DB[(PostgreSQL)]
    DB --> RLS[Row Level Security]
    DB --> RPC[Transactional RPC Functions]
    DB --> VAL[Triggers & Integrity Validation]

    UI --> CH[Recharts Analytics]
    UI --> EXP[PDF / CSV / Spreadsheet Workflows]

The frontend keeps UI concerns, state, domain calculations, and database access separated into dedicated layers:

Pages / Components
       ↓
Zustand Stores
       ↓
Services
       ↓
Supabase Client
       ↓
PostgreSQL + RLS + RPC Functions

This structure keeps financial rules testable and prevents critical business logic from living only inside presentation components.

🗃️ Core Data Model

Domain

Main Records

Academic configuration

academic_years

Accounts

accounts

Income

income_entries

Expenses

expense_entries

Transfers

transfers

Recurring expenses

recurring_templates

Students

students

Academic enrollment

student_enrollments

Recoverable advances

recoverables

Recoverable repayments

recoverable_repayments

Student identity and academic-year enrollment are intentionally separated. This allows a student to retain one identity while class, medium, annual fees, opening balances, and status change between academic years.

🔐 Data Integrity & Security

Financial software depends on correctness, not only interface design. The project therefore includes safeguards at both the application and database layers.

Protected application routes with Supabase authentication

User-owned financial data isolated through PostgreSQL Row Level Security

Database validation for income, expenses, transfers, academic years, student enrollments, and recoverables

Ownership checks for account-to-account transactions

Protection against invalid/self transfers and inconsistent account history

Atomic database workflows for multi-step operations such as initial setup and financial transactions

Student-fee validation that keeps obligations, payments, historical dues, and linked income consistent

Controlled backup/restore workflow

Local release-gate script that refuses to run destructive integration checks against a non-local Supabase host

🧮 Domain Rules Worth Highlighting

A few examples of domain behavior implemented in the project:

Transfers are not income or expenses — they move liquidity between accounts without changing profit.

Recoverable advances are not normal expenses — repayments restore liquidity without being counted as new income.

Previous-year fee collections retain their original academic-year context while still recording when the cash was actually received.

Student fee totals distinguish imported opening history from payments recorded through the application.

School profit and overall cash position are calculated separately so personal/home spending does not distort school operating performance.

Account balances are derived from transaction history rather than maintained as an unrelated mutable number.

📁 Project Structure

.
├── e2e/                         # Playwright end-to-end tests
├── public/                      # Static assets and web manifest
├── scripts/
│   └── local-release-gate.mjs   # Local database integration safety gate
├── src/
│   ├── components/              # Shared UI and feature components
│   │   ├── dashboard/           # Dashboard analytics components
│   │   ├── students/            # Student and fee-management components
│   │   └── ui/                  # shadcn/ui component primitives
│   ├── hooks/                   # Reusable React hooks
│   ├── integrations/supabase/   # Generated/typed Supabase integration
│   ├── lib/                     # Domain rules, imports, backup, i18n, utilities
│   ├── pages/                   # Route-level application pages
│   ├── services/                # Database/service abstraction layer
│   ├── store/                   # Zustand application stores
│   ├── test/                    # UI and integration tests
│   ├── types/                   # Finance and student TypeScript models
│   └── utils/                   # Academic-year, currency, ordering utilities
├── supabase/
│   ├── migrations/              # Schema, policies, RPCs, integrity changes
│   ├── preflight/               # Production-readiness SQL checks
│   └── tests/                   # Database integrity fixtures/tests
├── package.json
├── vite.config.ts
└── vitest.config.ts

⚙️ Getting Started

Prerequisites

Node.js 18+

npm

A Supabase project

Supabase CLI if you want to apply migrations from the command line or run the local database test workflow

1. Install dependencies

npm install

2. Configure environment variables

Create a .env file in the project root:

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

Never commit private service-role keys or other privileged credentials to the repository.

3. Apply the database migrations

The database schema, Row Level Security policies, validation functions, and RPC workflows are versioned under supabase/migrations/.

With a linked Supabase project, apply them using the Supabase CLI:

supabase db push

4. Start the development server

npm run dev

Vite will print the local development URL in the terminal.

🎮 Demo Mode Setup

The application supports anonymous demo sessions through Supabase.

To use Explore Demo:

Enable anonymous sign-ins in the Supabase Auth configuration.

Apply the included demo-workspace migration.

Start the application and select Explore Demo from the authentication screen.

The demo workflow can seed, reset, and discard its own isolated workspace.

✅ Quality Checks

The repository includes unit, integration, component, database-oriented, and end-to-end test coverage for important finance and student workflows.

# TypeScript validation
npm run typecheck

# ESLint
npm run lint

# Unit / integration tests
npm run test

# Production build
npm run build

# End-to-end tests
npm run test:e2e

Local database release gate

The E2E workflow runs a local finance integrity gate before Playwright:

npm run test:local-db

This script is intentionally guarded so it only accepts a loopback Supabase URL such as localhost or 127.0.0.1.

🧪 Test Coverage Areas

The test suite includes coverage for areas such as:

Financial-domain calculations

Account balances and money movement

Student fee calculations

Student spreadsheet import validation

Backup parsing and restoration behavior

Authentication and initial data loading

Setup redirects

Current and previous-year fee workflows

Payment recording and reversal behavior

Student ordering and class progression

Dashboard calculations and medium-level summaries

English/Gujarati UI behavior

Demo workspace behavior

Authenticated finance journeys through Playwright

💾 Backup & Restore

The settings area supports exporting application data to a dedicated backup file and restoring it through a controlled database workflow.

Backups include the core finance tables and use the .lfbackup extension so application backups are clearly distinguishable from normal exports.

📌 Engineering Focus

This project was developed with emphasis on:

Translating real administrative workflows into clear software models

Keeping financial calculations deterministic and testable

Separating UI, state, services, and database responsibilities

Preserving historical academic-year context

Designing for non-technical administrative users

Maintaining data consistency across connected student and finance workflows

Providing responsive interfaces for desktop and smaller screens

Supporting bilingual day-to-day use without duplicating application logic

🗺️ Current Status

The application is under active development. The repository already contains the core finance, student-fee, reporting, data-integrity, backup, demo, and automated-testing workflows, with further refinement focused on usability, operational reliability, and maintainability.

<div align="center">

Built around a simple principle: school finance data should be understandable, traceable, and difficult to accidentally corrupt.

</div>
