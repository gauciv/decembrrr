-- Classes: each class group with an invite code
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  daily_amount numeric(10,2) not null default 10.00,
  invite_code text unique not null default upper(substr(gen_random_uuid()::text, 1, 8)),
  president_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Profiles: extends auth.users with app-specific data
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  avatar_url text,
  role text not null default 'student' check (role in ('student', 'president')),
  class_id uuid references public.classes(id),
  balance numeric(10,2) not null default 0.00,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transactions: full ledger of deposits and deductions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  profile_id uuid not null references public.profiles(id),
  type text not null check (type in ('deposit', 'deduction')),
  amount numeric(10,2) not null,
  balance_before numeric(10,2) not null,
  balance_after numeric(10,2) not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- No-class dates: skip deduction on these days
create table public.no_class_dates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id),
  date date not null,
  reason text not null default 'No class',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(class_id, date)
);

-- Indexes
create index idx_profiles_class on public.profiles(class_id);
create index idx_transactions_profile on public.transactions(profile_id, created_at desc);
create index idx_transactions_class on public.transactions(class_id, created_at desc);
create index idx_no_class_dates_lookup on public.no_class_dates(class_id, date);
create index idx_classes_invite on public.classes(invite_code);
