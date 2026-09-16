create or replace function public.get_household_owner_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select invited.user_id
      from public.household_members invited
      where lower(invited.email) = lower(auth.jwt() ->> 'email')
      order by invited.created_at
      limit 1
    ),
    auth.uid()
  );
$$;

grant execute on function public.get_household_owner_id() to authenticated;

create unique index if not exists household_members_email_key
  on public.household_members (lower(email))
  where email is not null;

alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.categories enable row level security;

drop policy if exists household_members_private on public.household_members;
drop policy if exists household_members_shared_read on public.household_members;
drop policy if exists household_members_owner_write on public.household_members;
create policy household_members_shared_read on public.household_members
  for select to authenticated
  using (user_id = public.get_household_owner_id());
create policy household_members_owner_write on public.household_members
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists transactions_private on public.transactions;
drop policy if exists transactions_shared on public.transactions;
create policy transactions_shared on public.transactions
  for all to authenticated
  using (user_id = public.get_household_owner_id())
  with check (user_id = public.get_household_owner_id());

drop policy if exists monthly_budgets_private on public.monthly_budgets;
drop policy if exists monthly_budgets_shared on public.monthly_budgets;
create policy monthly_budgets_shared on public.monthly_budgets
  for all to authenticated
  using (user_id = public.get_household_owner_id())
  with check (user_id = public.get_household_owner_id());

drop policy if exists categories_readable_by_owner on public.categories;
drop policy if exists categories_insertable_by_owner on public.categories;
drop policy if exists categories_manageable_by_owner on public.categories;
drop policy if exists categories_shared_read on public.categories;
drop policy if exists categories_shared_write on public.categories;
create policy categories_shared_read on public.categories
  for select to authenticated
  using (owner_id is null or owner_id = public.get_household_owner_id());
create policy categories_shared_write on public.categories
  for all to authenticated
  using (owner_id = public.get_household_owner_id())
  with check (owner_id = public.get_household_owner_id());

create or replace function public.invite_household_member(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  owner_id uuid := public.get_household_owner_id();
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;

  if normalized_email = lower(auth.jwt() ->> 'email') then
    raise exception 'cannot_invite_self';
  end if;

  insert into public.household_members (user_id, name, email)
  select owner_id, split_part(normalized_email, '@', 1), normalized_email
  where not exists (
    select 1
    from public.household_members existing
    where existing.user_id = owner_id
      and lower(existing.email) = normalized_email
  );
end;
$$;

grant execute on function public.invite_household_member(text) to authenticated;
