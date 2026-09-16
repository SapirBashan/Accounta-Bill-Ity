create or replace function public.get_household_members()
returns table (id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  with accounts as (
    select members.id,
           split_part(lower(members.email), '@', 1) as name,
           lower(members.email) as email
    from public.household_members members
    where members.user_id = public.get_household_owner_id()
      and members.email is not null

    union

    select owner.id,
           split_part(lower(owner.email), '@', 1),
           lower(owner.email)
    from auth.users owner
    where owner.id = public.get_household_owner_id()
      and owner.email is not null

    union

    select auth.uid(),
           split_part(lower(auth.jwt() ->> 'email'), '@', 1),
           lower(auth.jwt() ->> 'email')
    where auth.uid() is not null
      and auth.jwt() ->> 'email' is not null
  )
  select distinct on (accounts.email) accounts.id, accounts.name, accounts.email
  from accounts
  order by accounts.email, accounts.id;
$$;

grant execute on function public.get_household_members() to authenticated;
