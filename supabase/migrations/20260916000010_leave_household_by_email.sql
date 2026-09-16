create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  delete from public.household_members
  where lower(email) = lower(auth.jwt() ->> 'email');
end;
$$;

grant execute on function public.leave_household() to authenticated;
