create table if not exists public.household_billing_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  cycle_start_day integer not null default 1 check (cycle_start_day between 1 and 31)
);

alter table public.household_billing_settings enable row level security;

drop policy if exists household_billing_settings_shared on public.household_billing_settings;
create policy household_billing_settings_shared on public.household_billing_settings
  for all to authenticated
  using (owner_id = public.get_household_owner_id())
  with check (owner_id = public.get_household_owner_id());
