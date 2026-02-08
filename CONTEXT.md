# Decembrrr — AI Agent Context

> **Purpose of this file**: Agentic AI context. Not a README. Used to prevent
> hallucination, track decisions, and provide project state to coding agents.

## What
Mobile-first PWA for tracking daily ₱10 Christmas party fund contributions.
Class-based system where a president collects cash, records deposits, and the
system auto-deducts daily via Lambda cron.

## Architecture
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 + shadcn/ui + lucide-react
- **Database & Auth**: Supabase (Postgres + Google OAuth + RLS)
- **Daily Deduction**: AWS Lambda triggered by EventBridge cron (23:59 PHT, Mon–Fri)
- **Infrastructure**: Terraform (S3, CloudFront, Lambda, EventBridge)

## Tech Stack Details
- TypeScript ~5.9.3 with `erasableSyntaxOnly`
- react-router-dom v7 (routing), @tanstack/react-query v5
- date-fns v4, react-day-picker v9
- html5-qrcode (QR scanning)
- @supabase/supabase-js v2

## Database Schema
- `classes` — id, name, daily_amount, fund_goal, collection_frequency, invite_code, president_id, created_at
- `profiles` — id, email, name, avatar_url, is_president (boolean), class_id, balance, is_active, created_at, updated_at
- `transactions` — id, class_id, profile_id, type ('deposit'|'deduction'), amount, balance_before, balance_after, note, created_by, created_at
- `no_class_dates` — id, class_id, date, reason, created_by, created_at

## RLS Strategy
- `get_my_class_id()` — SECURITY DEFINER helper to avoid recursion
- Classes: members can read own class, presidents can read own class, anyone can look up by invite_code for joining
- Profiles: users can read classmates, read/update own profile
- Transactions/no_class_dates: scoped to class_id via helper

## Key Flows
1. President creates class → gets invite code → shares with classmates
2. Students join via invite code (manual entry or QR scan) → Google OAuth
3. President records cash deposits via QR scan or manual entry → balance increases
4. EventBridge Lambda deducts ₱10 daily at 23:59 PHT (skips weekends + no-class dates)
5. President dashboard: fund overview, class list, wallet, analytics
6. Student dashboard: balance, transaction log, class status

## Frontend Routes
- `/` — Dashboard (PresidentHomeTab or StudentHomeTab based on is_president)
- `/class-list` — President: searchable student list, deposit, student log
- `/wallet` — President: fund balance, stats, CSV export, member balances
- `/analytics` — President: weekly stats, calendar heatmap
- `/calendar` — President: manage no-class date exemptions
- `/transactions` — Student: paginated transaction history
- `/class` — Student: class info, today's payment status
- `/join` — Join class via link (/join?code=XXXX)

## President Nav Layout
Bottom nav: Home | Class | [+FAB] | Wallet | Stats
- FAB opens QR scan flow for recording deposits

## Error Handling
All errors use `AppError` with typed error codes (ERR_XXXX). Categories:
- 1xxx — Config/Env | 2xxx — Auth | 3xxx — Class | 4xxx — Payment | 5xxx — Calendar | 9xxx — Generic

## Deployed Infrastructure
- Frontend URL: https://d2ttfm29xpbs1h.cloudfront.net
- S3 Bucket: decembrr-frontend-058264514399
- CloudFront ID: EEHZ3RPXBPVFZ

## CI/CD
GitHub Actions: `.github/workflows/deploy-frontend.yml`
Triggers on push to `main` when `frontend/` changes.
Secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

## Pending: Google Sheets Migration
The fund has been running for ~3 weeks on Google Sheets before this app.
Plan: build an in-app CSV import feature (president-only) with:
1. Simple CSV format: Name, Total Paid (two columns only)
2. Students join the app first via invite code
3. President uploads CSV → fuzzy name matching maps rows to registered members
4. President confirms/corrects matches via dropdown UI
5. System creates backdated migration transactions + sets correct balances
6. Unmatched rows stay as "pending" until students register
Key: class `created_at` must be backdated to actual fund start date.
This feature is NOT yet built — planned for after core bug fixes.

## Migration History
- 001: initial schema
- 002: functions
- 003: RLS policies
- 004: fix RLS recursion (SECURITY DEFINER helper), add fund_goal + collection_frequency
- 005: fix president class read after creation
- 006: role text → is_president boolean
- 007: allow class lookup by invite_code for joining (RLS fix)
