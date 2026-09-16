create or replace function public.get_household_members()
returns table (id uuid, name text, email text)
language sql
security definer
set search_path = public
as $$
  with shared_members as (
    select members.id, members.name, members.email
    from public.household_members members
    where members.user_id = public.get_household_owner_id()
      and members.email is not null
  ),
  current_account as (
    select auth.uid() as id,
           split_part(lower(auth.jwt() ->> 'email'), '@', 1) as name,
           lower(auth.jwt() ->> 'email') as email
    where auth.uid() is not null
      and auth.jwt() ->> 'email' is not null
      and not exists (
        select 1
        from shared_members
        where lower(shared_members.email) = lower(auth.jwt() ->> 'email')
      )
  )
  select id, name, email from shared_members
  union all
  select id, name, email from current_account
  order by email;
$$;

grant execute on function public.get_household_members() to authenticated;