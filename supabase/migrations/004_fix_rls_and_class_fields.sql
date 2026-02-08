-- Fix RLS infinite recursion on profiles table
-- The "read classmates" policy was querying profiles to check class_id,
-- which triggered RLS again. Solution: use a SECURITY DEFINER helper
-- function that bypasses RLS to get the user's class_id.

-- Helper: returns the authenticated user's class_id without triggering RLS
create or replace function public.get_my_class_id()
returns uuid as $$
  select class_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Drop the problematic policies
drop policy if exists "Users can read classmates" on public.profiles;
drop policy if exists "Anyone can read classes they belong to" on public.classes;
drop policy if exists "Class members can read no-class dates" on public.no_class_dates;

-- Recreated policies using the helper function (no recursion)
create policy "Users can read classmates"
  on public.profiles for select using (
    class_id = public.get_my_class_id()
  );

create policy "Anyone can read classes they belong to"
  on public.classes for select using (
    id = public.get_my_class_id()
  );

create policy "Class members can read no-class dates"
  on public.no_class_dates for select using (
    class_id = public.get_my_class_id()
  );

-- Add new columns to classes for richer setup
alter table public.classes
  add column if not exists fund_goal numeric(10,2),
  add column if not exists collection_frequency text not null default 'daily'
    check (collection_frequency in ('daily', 'weekly'));

-- Allow users without a class_id to read their own profile
-- (needed during onboarding before joining/creating a class)
-- The existing "Users can read own profile" policy already covers this.
