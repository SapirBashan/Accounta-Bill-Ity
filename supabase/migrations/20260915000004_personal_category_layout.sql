alter table public.user_category_preferences
  add column if not exists sort_order integer not null default 0;

create index if not exists user_category_preferences_order_idx
  on public.user_category_preferences (user_id, sort_order);

alter table public.categories enable row level security;

drop policy if exists categories_readable_by_owner on public.categories;
drop policy if exists categories_insertable_by_owner on public.categories;
drop policy if exists categories_manageable_by_owner on public.categories;

create policy categories_readable_by_owner on public.categories
  for select to authenticated
  using (owner_id is null or auth.uid() = owner_id);

create policy categories_insertable_by_owner on public.categories
  for insert to authenticated
  with check (auth.uid() = owner_id);

create policy categories_manageable_by_owner on public.categories
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

insert into public.user_category_preferences (user_id, category_id, active, sort_order)
select users.id,
       categories.id,
       true,
       row_number() over (
         partition by users.id
         order by categories.group_name, categories.name, categories.id
       ) - 1
from auth.users users
cross join public.categories categories
where categories.owner_id is null
   or categories.owner_id = users.id
on conflict (user_id, category_id) do nothing;