import type { SupabaseClient } from '@supabase/supabase-js';

export async function getHouseholdOwnerId(
  supabase: SupabaseClient,
  fallbackUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('get_household_owner_id');
  if (error) {
    console.error('Household sharing is not configured:', error.message);
    return fallbackUserId;
  }

  return typeof data === 'string' ? data : fallbackUserId;
}
