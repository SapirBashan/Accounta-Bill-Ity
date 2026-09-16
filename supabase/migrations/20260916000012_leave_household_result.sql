drop function if exists public.leave_household();

create function public.leave_household()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  delete from public.household_members
  where lower(email) = lower(auth.jwt() ->> 'email');

  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

grant execute on function public.leave_household() to authenticated;
