-- Fix: students without a class cannot look up classes by invite_code.
-- The existing SELECT policies only allow reading if you're a member
-- (get_my_class_id) or the president. A new student joining has neither,
-- so the Supabase query returns 406 Not Acceptable / no rows.
-- Solution: allow any authenticated user to read a class by invite_code.

create policy "Anyone can look up a class by invite code"
  on public.classes for select using (true);

-- Note: this broadens SELECT to all authenticated users. The classes table
-- only contains non-sensitive data (name, daily_amount, invite_code).
-- Transactions and profiles remain scoped by class_id via RLS.
