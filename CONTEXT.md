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
- [ ] Deployment & testing

## Deployed Infrastructure
- **Frontend URL**: https://d2ttfm29xpbs1h.cloudfront.net
- **S3 Bucket**: decembrr-frontend-058264514399
- **CloudFront ID**: EEHZ3RPXBPVFZ

## CI/CD
GitHub Actions workflow at `.github/workflows/deploy-frontend.yml`.
Triggers on push to `main` when files in `frontend/` change.
Required repo secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
