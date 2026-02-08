-- Migrate role column from text ('student'|'president') to boolean is_president.
-- Presidents are also class members who pay — they just have admin privileges.

-- 1. Add the new boolean column
alter table public.profiles
  add column if not exists is_president boolean not null default false;

-- 2. Backfill from existing role data
update public.profiles set is_president = true where role = 'president';

-- 3. Drop the old role column (and its check constraint)
alter table public.profiles drop column role;
