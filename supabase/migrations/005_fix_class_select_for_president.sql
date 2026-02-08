-- Fix: president can't read their own class right after creating it.
-- The SELECT policy uses get_my_class_id() which returns null during
-- class creation (profile.class_id hasn't been set yet). This causes
-- the .select() after INSERT to return 403.
-- Fix: let presidents always read classes they own.

create policy "Presidents can read own classes"
  on public.classes for select using (
    president_id = auth.uid()
  );
