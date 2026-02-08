-- Row Level Security policies
alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.no_class_dates enable row level security;

-- CLASSES
create policy "Anyone can read classes they belong to"
  on public.classes for select using (
    id in (select class_id from public.profiles where id = auth.uid())
  );

create policy "Authenticated users can create classes"
  on public.classes for insert with check (
    auth.uid() = president_id
  );

-- PROFILES
create policy "Users can read own profile"
  on public.profiles for select using (id = auth.uid());

create policy "Users can read classmates"
  on public.profiles for select using (
    class_id in (select class_id from public.profiles where id = auth.uid())
  );

create policy "Users can update own profile"
  on public.profiles for update using (id = auth.uid());

create policy "President can update class members"
  on public.profiles for update using (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );

create policy "Trigger can insert profiles"
  on public.profiles for insert with check (true);

-- TRANSACTIONS
create policy "Users can read own transactions"
  on public.transactions for select using (profile_id = auth.uid());

create policy "President can read class transactions"
  on public.transactions for select using (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );

create policy "President can insert transactions (deposits)"
  on public.transactions for insert with check (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );

-- NO_CLASS_DATES
create policy "Class members can read no-class dates"
  on public.no_class_dates for select using (
    class_id in (select class_id from public.profiles where id = auth.uid())
  );

create policy "President can manage no-class dates"
  on public.no_class_dates for all using (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );
