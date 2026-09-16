create or replace function public.get_household_members()
returns table (id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  with household_owners as (
    select public.get_household_owner_id() as user_id
  )
  select distinct members.id, members.name, members.email
  from public.household_members members
  join household_owners owners on owners.user_id = members.user_id
  where members.email is not null
  order by members.email;
$$;

grant execute on function public.get_household_members() to authenticated;