-- Function to look up a student by ID (bypasses RLS)
-- Returns basic profile info + whether they belong to the caller's class
create or replace function public.lookup_student(student_id uuid)
returns jsonb as $$
declare
  student_row record;
  caller_class_id uuid;
begin
  -- Get caller's class_id
  select class_id into caller_class_id
  from public.profiles
  where id = auth.uid();

  -- Get student profile
  select id, name, avatar_url, balance, is_active, class_id
  into student_row
  from public.profiles
  where id = student_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'id', student_row.id,
    'name', student_row.name,
    'avatar_url', student_row.avatar_url,
    'balance', student_row.balance,
    'is_active', student_row.is_active,
    'in_class', (student_row.class_id = caller_class_id)
  );
end;
$$ language plpgsql security definer;
