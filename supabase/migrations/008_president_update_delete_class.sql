-- Allow president to update their own class
create policy "President can update own class"
  on public.classes for update using (
    president_id = auth.uid()
  );

-- Allow president to delete their own class
create policy "President can delete own class"
  on public.classes for delete using (
    president_id = auth.uid()
  );

-- Allow deleting transactions when class is deleted (cascade cleanup)
create policy "President can delete class transactions"
  on public.transactions for delete using (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );

-- Allow deleting no-class dates when class is deleted (cascade cleanup)
create policy "President can delete class no-class dates"
  on public.no_class_dates for delete using (
    class_id in (
      select id from public.classes where president_id = auth.uid()
    )
  );
