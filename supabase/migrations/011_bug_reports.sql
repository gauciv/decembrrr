-- Bug reports table
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  reporter_name text not null,
  reporter_email text not null,
  category text not null check (category in ('ui', 'payment', 'account', 'performance', 'other')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  description text not null,
  steps_to_reproduce text,
  expected_behavior text,
  device_info text,
  screenshot_urls text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'in-progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Indexes
create index idx_bug_reports_status on public.bug_reports(status);
create index idx_bug_reports_created on public.bug_reports(created_at desc);
create index idx_bug_reports_reporter on public.bug_reports(reporter_id);

-- RLS
alter table public.bug_reports enable row level security;

-- Any authenticated user can submit a bug report
create policy "Users can insert bug reports"
  on public.bug_reports for insert with check (auth.uid() = reporter_id);

-- Users can read their own bug reports
create policy "Users can read own bug reports"
  on public.bug_reports for select using (auth.uid() = reporter_id);

-- Presidents can read all bug reports (admin access)
create policy "Presidents can read all bug reports"
  on public.bug_reports for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_president = true
    )
  );

-- Presidents can update bug reports (change status, add notes)
create policy "Presidents can update bug reports"
  on public.bug_reports for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_president = true
    )
  );

-- Storage bucket for bug report screenshots
insert into storage.buckets (id, name, public)
values ('bug-screenshots', 'bug-screenshots', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload to bug-screenshots
create policy "Authenticated users can upload screenshots"
  on storage.objects for insert
  with check (bucket_id = 'bug-screenshots' and auth.role() = 'authenticated');

-- Public read access for bug screenshots
create policy "Public read access for bug screenshots"
  on storage.objects for select
  using (bucket_id = 'bug-screenshots');
