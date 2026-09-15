import type { SupabaseClient } from '@supabase/supabase-js';

export type UserCategory = {
  id: string;
  name: string;
  group_name: string;
  type: string;
  default_budget: number;
  active: boolean;
  sort_order: number;
  owner_id?: string | null;
};

export async function getUserCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserCategory[]> {
  const categoriesQuery = supabase
      .from('categories')
      .select('id, name, group_name, type, default_budget, owner_id')
      .or(`owner_id.is.null,owner_id.eq.${userId}`)
      .neq('name', 'משכורת עמליה');
  const preferencesQuery = supabase
      .from('user_category_preferences')
      .select('category_id, active, sort_order')
      .eq('user_id', userId);
  const [{ data: categoryData, error: categoryError }, { data: preferenceData, error: preferenceError }] = await Promise.all([
    categoriesQuery,
    preferencesQuery,
  ]);
  const { data: legacyCategories } = categoryError
    ? await supabase
      .from('categories')
      .select('id, name, group_name, type, default_budget')
      .neq('name', 'משכורת עמליה')
    : { data: null };
  const { data: legacyPreferences } = preferenceError
    ? await supabase
      .from('user_category_preferences')
      .select('category_id, active')
      .eq('user_id', userId)
    : { data: null };
  const categories = (categoryData || legacyCategories || []) as Array<{
    id: string;
    name: string;
    group_name: string;
    type: string;
    default_budget: number;
    owner_id?: string | null;
  }>;
  const preferences = (preferenceData || legacyPreferences || []) as Array<{
    category_id: string;
    active: boolean;
    sort_order?: number;
  }>;

  const preferenceMap = new Map(
    (preferences || []).map((preference) => [preference.category_id, preference]),
  );
  const hasPreferences = preferenceMap.size > 0;

  return (categories || [])
    .map((category) => {
      const preference = preferenceMap.get(category.id);
      return {
        id: category.id,
        name: category.name,
        group_name: category.group_name,
        type: category.type,
        default_budget: Number(category.default_budget) || 0,
        active: preference?.active ?? (
          category.owner_id === userId || (!hasPreferences && !category.owner_id)
        ),
        sort_order: preference?.sort_order ?? Number.MAX_SAFE_INTEGER,
        owner_id: category.owner_id ?? null,
      };
    })
    .sort((left, right) =>
      left.sort_order - right.sort_order ||
      left.group_name.localeCompare(right.group_name) ||
      left.name.localeCompare(right.name),
    );
}

export async function ensureUserCategoryPreferences(
  supabase: SupabaseClient,
  userId: string,
) {
  const { count } = await supabase
    .from('user_category_preferences')
    .select('category_id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (count && count > 0) return;

  const categories = await getUserCategories(supabase, userId);
  const defaults = categories.map((category, sort_order) => ({
      user_id: userId,
      category_id: category.id,
      active: category.active,
      sort_order,
    }));
  if (defaults.length > 0) {
    const { error } = await supabase
      .from('user_category_preferences')
      .upsert(defaults, { onConflict: 'user_id,category_id' });
    if (error) {
      await supabase.from('user_category_preferences').upsert(
        defaults.map(({ user_id, category_id, active }) => ({ user_id, category_id, active })),
        { onConflict: 'user_id,category_id' },
      );
    }
  }
}