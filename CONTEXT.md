# Decembrrr — Project Context

## What
Mobile-first PWA for tracking daily ₱10 Christmas party fund contributions.

## Architecture
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui → deployed to S3 + CloudFront
- **Database & Auth**: Supabase (Postgres + Google OAuth)
- **Daily Deduction**: AWS Lambda triggered by EventBridge cron (23:59 PHT, Mon–Fri)
- **Infrastructure**: Terraform

## Key Entities
- `classes` — a class group with invite code, daily amount, president
- `profiles` — extends Supabase auth.users with balance, role, class membership
- `transactions` — ledger of deposits (+) and deductions (-)
- `no_class_dates` — dates to skip deduction (holidays, typhoons)

## Flows
1. President creates class → gets invite code
2. Students join via invite link → Google OAuth
3. President records cash deposits → balance increases
4. EventBridge Lambda deducts ₱10 daily (skips weekends + no-class dates)
5. Everyone sees transaction history; president sees class fund summary

## Status
- [x] Project scaffolding
- [x] Supabase schema + migrations + RLS
- [x] Terraform infra (S3, CloudFront, Lambda, EventBridge)
- [x] Lambda deduction function
- [x] Frontend scaffold (Vite + React + shadcn)
- [x] Frontend pages (login, onboarding, dashboard, payments, fund, calendar)
- [x] PWA manifest
- [x] Code-split bundle (lazy routes + vendor chunks)
- [x] CI/CD: GitHub Actions deploys frontend on push to main
- [x] Error handling: error codes, config guard, error boundary, error screen
- [ ] Google OAuth provider setup in Supabase
- [ ] Deployment & testing

## Deployed Infrastructure
- **Frontend URL**: https://d2ttfm29xpbs1h.cloudfront.net
- **S3 Bucket**: decembrr-frontend-058264514399
- **CloudFront ID**: EEHZ3RPXBPVFZ

## CI/CD
GitHub Actions workflow at `.github/workflows/deploy-frontend.yml`.
Triggers on push to `main` when files in `frontend/` change.
Required repo secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Error Handling
All errors use `AppError` with typed error codes (ERR_XXXX). Categories:
- **1xxx** — Config/Env (missing Supabase URL/key, unreachable)
- **2xxx** — Auth (not authenticated, session expired, OAuth failure, profile missing)
- **3xxx** — Class (not found, invalid invite, already member, create failed)
- **4xxx** — Payment (student not found, invalid amount, record failed, not president)
- **5xxx** — Calendar (date exists, save failed)
- **9xxx** — Generic (network error, unknown)

Key files:
- `frontend/src/lib/errors.ts` — ErrorCode constants, AppError class, resolveError()
- `frontend/src/lib/supabase.ts` — Config validation + lazy Proxy client
- `frontend/src/components/error-boundary.tsx` — React ErrorBoundary (catches render errors)
- `frontend/src/components/error-screen.tsx` — User-facing error UI with troubleshooting steps
- `frontend/src/App.tsx` — ConfigGuard wraps app, shows ErrorScreen if .env is missing
