alter table public.household_members
	add column if not exists email text;

drop index if exists public.household_members_email_key;

drop function if exists public.get_household_members();
drop function if exists public.invite_household_member(text);
drop function if exists public.get_household_owner_id();

alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_budgets enable row level security;

do $$
declare
	policy_record record;
begin
	for policy_record in
		select schemaname, tablename, policyname
		from pg_policies
		where schemaname = 'public'
			and tablename in ('household_members', 'transactions', 'monthly_budgets')
	loop
		execute format(
			'drop policy if exists %I on %I.%I',
			policy_record.policyname,
			policy_record.schemaname,
			policy_record.tablename
		);
	end loop;
end;
$$;

create policy household_members_private on public.household_members
	for all to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy transactions_private on public.transactions
	for all to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);

create policy monthly_budgets_private on public.monthly_budgets
	for all to authenticated
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);