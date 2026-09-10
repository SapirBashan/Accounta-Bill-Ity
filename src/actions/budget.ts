'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Fetch monthly planned budgets merged with default category baseline
 */
export async function getMonthlyBudgets(monthStr: string) {
  const monthDate = `${monthStr}-01`;

  const { data: categories } = await supabase.from('categories').select('*');
  const { data: monthly } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', monthDate);

  const monthlyMap: Record<string, number> = {};
  monthly?.forEach((m) => {
    monthlyMap[m.category_id] = Number(m.planned_amount);
  });

  return (categories || []).map((cat) => ({
    category_id: cat.id,
    category_name: cat.name,
    group_name: cat.group_name,
    planned_amount: monthlyMap[cat.id] ?? cat.default_budget ?? 0,
  }));
}

/**
 * Save/Update single category budget target for a month
 */
export async function updateCategoryBudget(categoryId: string, monthStr: string, amount: number) {
  const monthDate = `${monthStr}-01`;

  const { error } = await supabase.from('monthly_budgets').upsert(
    {
      category_id: categoryId,
      month: monthDate,
      planned_amount: amount,
    },
    { onConflict: 'user_id,category_id,month' }
  );

  if (error) console.error('Error updating budget:', error);
  revalidatePath('/budget');
}

/**
 * Copy entire budget configuration from previous month
 */
export async function copyLastMonthBudgets(currentMonthStr: string) {
  const currentDate = new Date(`${currentMonthStr}-01`);
  currentDate.setMonth(currentDate.getMonth() - 1);
  const prevMonthStr = currentDate.toISOString().slice(0, 10);

  const { data: prevBudgets } = await supabase
    .from('monthly_budgets')
    .select('category_id, planned_amount')
    .eq('month', prevMonthStr);

  if (!prevBudgets || prevBudgets.length === 0) return;

  const inserts = prevBudgets.map((b) => ({
    category_id: b.category_id,
    month: `${currentMonthStr}-01`,
    planned_amount: b.planned_amount,
  }));

  await supabase.from('monthly_budgets').upsert(inserts, { onConflict: 'user_id,category_id,month' });
  revalidatePath('/budget');
}