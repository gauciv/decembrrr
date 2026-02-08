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
- [ ] Deployment & testing
