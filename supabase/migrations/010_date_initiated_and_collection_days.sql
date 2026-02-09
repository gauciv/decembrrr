-- Add date_initiated (when the class fund actually started collecting)
-- and collection_days (array of weekday numbers: 1=Mon … 7=Sun)
-- replacing the old daily/weekly collection_frequency concept.

alter table public.classes
  add column if not exists date_initiated date not null default current_date,
  add column if not exists collection_days smallint[] not null default '{1,2,3,4,5}';

-- Backfill: set date_initiated to created_at date for existing classes
update public.classes
  set date_initiated = (created_at at time zone 'Asia/Manila')::date
  where date_initiated = current_date and created_at < current_date;

-- Update the daily deduction function to use collection_days instead of
-- hardcoded weekday skipping.
create or replace function public.run_daily_deduction(target_date date)
returns jsonb as $$
declare
  class_rec record;
  student_rec record;
  deducted_count int := 0;
  skipped_classes int := 0;
  target_dow smallint;
begin
  -- ISO weekday: 1=Mon … 7=Sun
  target_dow := extract(isodow from target_date)::smallint;

  for class_rec in select * from public.classes loop
    -- Skip if target_date is before the class was initiated
    if target_date < class_rec.date_initiated then
      skipped_classes := skipped_classes + 1;
      continue;
    end if;

    -- Skip if today's weekday is not in this class's collection_days
    if not (target_dow = any(class_rec.collection_days)) then
      skipped_classes := skipped_classes + 1;
      continue;
    end if;

    -- Skip if this date is marked as no-class
    if exists (
      select 1 from public.no_class_dates
      where class_id = class_rec.id and date = target_date
    ) then
      skipped_classes := skipped_classes + 1;
      continue;
    end if;

    -- Deduct from all active students in this class
    for student_rec in
      select * from public.profiles
      where class_id = class_rec.id and is_active = true
    loop
      insert into public.transactions (class_id, profile_id, type, amount, balance_before, balance_after, note)
      values (
        class_rec.id,
        student_rec.id,
        'deduction',
        class_rec.daily_amount,
        student_rec.balance,
        student_rec.balance - class_rec.daily_amount,
        'Daily contribution – ' || to_char(target_date, 'Mon DD, YYYY')
      );

      update public.profiles
      set balance = balance - class_rec.daily_amount, updated_at = now()
      where id = student_rec.id;

      deducted_count := deducted_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'date', target_date,
    'deducted_students', deducted_count,
    'skipped_classes', skipped_classes
  );
end;
$$ language plpgsql security definer;

-- RPC: Rollback a no-class date — reverse deductions that occurred on that day
-- Used when president accidentally didn't mark a day as no-class and wants to undo.
create or replace function public.rollback_no_class_date(
  p_class_id uuid,
  p_date date
)
returns jsonb as $$
declare
  txn_rec record;
  rolled_back int := 0;
begin
  -- Verify caller is president of this class
  if not exists (
    select 1 from public.classes
    where id = p_class_id and president_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  -- Find all deductions for this class on this date and reverse them
  for txn_rec in
    select t.id, t.profile_id, t.amount
    from public.transactions t
    where t.class_id = p_class_id
      and t.type = 'deduction'
      and (t.created_at at time zone 'Asia/Manila')::date = p_date
  loop
    -- Refund the student
    update public.profiles
    set balance = balance + txn_rec.amount, updated_at = now()
    where id = txn_rec.profile_id;

    -- Record the refund as a deposit transaction
    insert into public.transactions (class_id, profile_id, type, amount, balance_before, balance_after, note, created_by)
    select
      p_class_id,
      txn_rec.profile_id,
      'deposit',
      txn_rec.amount,
      p.balance - txn_rec.amount,
      p.balance,
      'Rollback – No class on ' || to_char(p_date, 'Mon DD, YYYY'),
      auth.uid()
    from public.profiles p where p.id = txn_rec.profile_id;

    rolled_back := rolled_back + 1;
  end loop;

  -- Add the no-class date record
  insert into public.no_class_dates (class_id, date, reason, created_by)
  values (p_class_id, p_date, 'No class (rollback)', auth.uid())
  on conflict (class_id, date) do nothing;

  return jsonb_build_object(
    'status', 'completed',
    'date', p_date,
    'rolled_back', rolled_back
  );
end;
$$ language plpgsql security definer;
