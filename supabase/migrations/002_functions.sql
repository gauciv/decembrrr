-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Deduction RPC: called by Lambda, runs under service_role
create or replace function public.run_daily_deduction(target_date date)
returns jsonb as $$
declare
  class_rec record;
  student_rec record;
  deducted_count int := 0;
  skipped_classes int := 0;
begin
  -- Skip weekends
  if extract(dow from target_date) in (0, 6) then
    return jsonb_build_object('status', 'skipped', 'reason', 'weekend', 'date', target_date);
  end if;

  for class_rec in select * from public.classes loop
    -- Check if this date is marked as no-class for this class
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
      -- Record transaction
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

      -- Update balance
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
