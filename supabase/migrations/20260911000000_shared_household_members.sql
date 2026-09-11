alter table public.household_members
  add column if not exists email text;

create unique index if not exists household_members_email_key
  on public.household_members (lower(email))
  where email is not null;

create or replace function public.get_household_members()
returns table (id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  with household_owners as (
    select auth.uid() as user_id
    union
    select invited.user_id
    from public.household_members invited
    where lower(invited.email) = lower(auth.jwt() ->> 'email')
      and invited.user_id is not null
  )
  select distinct members.id, members.name, members.email
  from public.household_members members
  join household_owners owners on owners.user_id = members.user_id
  order by members.id;
$$;

create or replace function public.invite_household_member(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;

  if normalized_email = lower(auth.jwt() ->> 'email') then
    raise exception 'cannot_invite_self';
  end if;

  insert into public.household_members (user_id, name, email)
  select auth.uid(), split_part(normalized_email, '@', 1), normalized_email
  where not exists (
    select 1
    from public.household_members existing
    where existing.user_id = auth.uid()
      and lower(existing.email) = normalized_email
  );
end;
$$;

grant execute on function public.get_household_members() to authenticated;
grant execute on function public.invite_household_member(text) to authenticated;

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
      limit 1
    ),
    auth.uid()
  );
$$;

grant execute on function public.get_household_owner_id() to authenticated;