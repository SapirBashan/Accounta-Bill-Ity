'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { ensureUserCategoryPreferences, getUserCategories } from '@/lib/category-data';

/**
 * Fetch the user's planned budgets for one month.
 */
export async function getMonthlyBudgets(monthStr: string) {
  const supabase = await getSupabaseServer();
  const monthDate = `${monthStr}-01`;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const categories = await getUserCategories(supabase, authData.user.id);
  const { data: monthly } = await supabase
    .from('monthly_budgets')
    .select('*')
    .eq('month', monthDate)
    .eq('user_id', authData.user.id);

  const monthlyMap: Record<string, number> = {};
  monthly?.forEach((m) => {
    monthlyMap[m.category_id] = Number(m.planned_amount);
  });

  return categories.filter((cat) => cat.active).map((cat) => ({
    category_id: cat.id,
    category_name: cat.name,
    group_name: cat.group_name,
    type: cat.type,
    planned_amount: monthlyMap[cat.id] ?? 0,
  }));
}

export async function getCategoryCatalog() {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  return getUserCategories(supabase, authData.user.id);
}

export async function setCategoryActive(categoryId: string, active: boolean) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('חובה להתחבר למערכת כדי לעדכן קטגוריות');
  await ensureUserCategoryPreferences(supabase, authData.user.id);

  const { error } = await supabase.from('user_category_preferences').upsert(
    { user_id: authData.user.id, category_id: categoryId, active },
    { onConflict: 'user_id,category_id' }
  );
  if (error && !error.message.includes('user_category_preferences')) {
    throw new Error(error.message);
  }

  revalidatePath('/budget');
  revalidatePath('/add');
  revalidatePath('/');
}

export async function reorderCategories(categoryIds: string[]) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('חובה להתחבר למערכת כדי לסדר קטגוריות');
  await ensureUserCategoryPreferences(supabase, authData.user.id);

  const categories = await getUserCategories(supabase, authData.user.id);
  const allowedIds = new Set(categories.map((category) => category.id));
  const orderedIds = categoryIds.filter((categoryId) => allowedIds.has(categoryId));
  const updates = orderedIds.map((categoryId, sort_order) => ({
    user_id: authData.user.id,
    category_id: categoryId,
    active: categories.find((category) => category.id === categoryId)?.active ?? true,
    sort_order,
  }));

  if (updates.length > 0) {
    const { error } = await supabase
      .from('user_category_preferences')
      .upsert(updates, { onConflict: 'user_id,category_id' });
    if (error && !error.message.includes('user_category_preferences')) {
      throw new Error(error.message);
    }
  }

  revalidatePath('/budget');
  revalidatePath('/add');
  revalidatePath('/');
}

/**
 * Save/Update single category budget target for a month
 */
export async function updateCategoryBudget(categoryId: string, monthStr: string, amount: number) {
  const supabase = await getSupabaseServer();
  const monthDate = `${monthStr}-01`;
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('חובה להתחבר למערכת כדי לעדכן תקציב');

  const { error } = await supabase.from('monthly_budgets').upsert(
    {
      category_id: categoryId,
      month: monthDate,
      planned_amount: amount,
      user_id: authData.user.id,
    },
    { onConflict: 'user_id,category_id,month' }
  );

  if (error) console.error('Error updating budget:', error);
  revalidatePath('/budget');
  revalidatePath('/');
}

/**
 * Copy entire budget configuration from previous month
 */
export async function copyLastMonthBudgets(currentMonthStr: string) {
  const supabase = await getSupabaseServer();
  const currentDate = new Date(`${currentMonthStr}-01`);
  currentDate.setMonth(currentDate.getMonth() - 1);
  const prevMonthStr = currentDate.toISOString().slice(0, 10);
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return;

  const { data: prevBudgets } = await supabase
    .from('monthly_budgets')
    .select('category_id, planned_amount')
    .eq('month', prevMonthStr)
    .eq('user_id', authData.user.id);

  if (!prevBudgets || prevBudgets.length === 0) return;

  const inserts = prevBudgets.map((b) => ({
    category_id: b.category_id,
    month: `${currentMonthStr}-01`,
    planned_amount: b.planned_amount,
    user_id: authData.user.id,
  }));

  await supabase.from('monthly_budgets').upsert(inserts, { onConflict: 'user_id,category_id,month' });
  revalidatePath('/budget');
  revalidatePath('/');
}

export async function createCategory(name: string, groupName: string, type: 'fixed_expense' | 'variable_expense' | 'income') {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('חובה להתחבר למערכת כדי להוסיף קטגוריה');
  await ensureUserCategoryPreferences(supabase, authData.user.id);

  const trimmedName = name.trim();
  const trimmedGroup = groupName.trim();
  if (!trimmedName || !trimmedGroup) throw new Error('יש למלא שם קטגוריה וקבוצה');

  let { data: createdCategory, error } = await supabase
    .from('categories')
    .insert({
      name: trimmedName,
      group_name: trimmedGroup,
      type,
      default_budget: 0,
      owner_id: authData.user.id,
    })
    .select('id')
    .single();
  if (error?.message.includes('owner_id')) {
    const legacyInsert = await supabase
      .from('categories')
      .insert({ name: trimmedName, group_name: trimmedGroup, type, default_budget: 0 })
      .select('id')
      .single();
    createdCategory = legacyInsert.data;
    error = legacyInsert.error;
  }
  if (error) throw new Error(error.message);

  if (createdCategory) {
    const { data: lastPreference } = await supabase
      .from('user_category_preferences')
      .select('sort_order')
      .eq('user_id', authData.user.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const preference = {
      user_id: authData.user.id,
      category_id: createdCategory.id,
      active: true,
      sort_order: (lastPreference?.sort_order ?? -1) + 1,
    };
    const { error: preferenceError } = await supabase
      .from('user_category_preferences')
      .upsert(preference, { onConflict: 'user_id,category_id' });
    if (preferenceError) {
      await supabase.from('user_category_preferences').upsert(
        { user_id: preference.user_id, category_id: preference.category_id, active: true },
        { onConflict: 'user_id,category_id' },
      );
    }
  }

  revalidatePath('/budget');
  revalidatePath('/add');
}