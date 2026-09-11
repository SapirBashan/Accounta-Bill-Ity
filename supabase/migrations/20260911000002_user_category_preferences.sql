create table if not exists public.user_category_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

alter table public.user_category_preferences enable row level security;

drop policy if exists user_category_preferences_private on public.user_category_preferences;
create policy user_category_preferences_private on public.user_category_preferences
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

update public.categories
set name = 'משכורת'
where type = 'income' and name = 'משכורת ספיר';

do $$
);