import type { SupabaseClient } from '@supabase/supabase-js';

export async function getHouseholdOwnerId(
  supabase: SupabaseClient,
  fallbackUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('get_household_owner_id');
  return !error && typeof data === 'string' ? data : fallbackUserId;
}
