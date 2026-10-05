create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date);

create index if not exists transactions_user_category_date_idx
  on public.transactions (user_id, category_id, date);

create index if not exists monthly_budgets_user_month_idx
  on public.monthly_budgets (user_id, month);
