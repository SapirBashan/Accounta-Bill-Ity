import type { SupabaseClient } from '@supabase/supabase-js';

export type UserCategory = {
  id: string;
  name: string;
  group_name: string;
  type: string;
  default_budget: number;
  active: boolean;
  sort_order: number;
};

export async function getUserCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserCategory[]> {
  const [{ data: categories }, { data: preferences }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, group_name, type, default_budget, owner_id')
      .or(`owner_id.is.null,owner_id.eq.${userId}`)
      .neq('name', 'משכורת עמליה'),
    supabase
      .from('user_category_preferences')
      .select('category_id, active, sort_order')
      .eq('user_id', userId),
  ]);

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
          category.owner_id === userId || (!hasPreferences && category.owner_id === null)
        ),
        sort_order: preference?.sort_order ?? Number.MAX_SAFE_INTEGER,
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
    await supabase
      .from('user_category_preferences')
      .upsert(defaults, { onConflict: 'user_id,category_id' });
  }
}