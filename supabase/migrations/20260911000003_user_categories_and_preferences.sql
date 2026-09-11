alter table public.categories
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists categories_owner_id_idx
  on public.categories(owner_id);

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
where type = 'income' and name = 'משכורתר';

insert into public.categories (name, type, group_name, default_budget)
select 'משכורת', 'income', 'הכנסות', 0
where not exists (
  select 1 from public.categories where type = 'income' and name = 'משכורת'
);

do $$
declare
  canonical_id uuid;
  duplicate_id uuid;
begin
  select id into canonical_id
  from public.categories
  where type = 'income' and name = 'הכנסות נוספות'
  order by id
  limit 1;

  if canonical_id is null then
    select id into canonical_id
    from public.categories
    where type = 'income' and name in ('הכנסה נוספת', 'משכורת עמליה')
    order by id
    limit 1;

    if canonical_id is not null then
      update public.categories set name = 'הכנסות נוספות' where id = canonical_id;
    end if;
  end if;

  if canonical_id is null then
    insert into public.categories (name, type, group_name, default_budget)
    values ('הכנסות נוספות', 'income', 'הכנסות', 0)
    returning id into canonical_id;
  end if;

  for duplicate_id in
    select id
    from public.categories
    where type = 'income'
      and name in ('הכנסה נוספת')
      and id <> canonical_id
  loop
    update public.transactions set category_id = canonical_id where category_id = duplicate_id;
    delete from public.monthly_budgets where category_id = duplicate_id;
    delete from public.user_category_preferences where category_id = duplicate_id;
    delete from public.categories where id = duplicate_id;
  end loop;
end $$;
