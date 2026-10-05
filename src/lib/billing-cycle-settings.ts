import { getSupabaseServer } from '@/lib/supabase-server';
import { DEFAULT_BILLING_CYCLE_START_DAY } from '@/lib/billing-cycle';

type ServerSupabase = Awaited<ReturnType<typeof getSupabaseServer>>;

export async function getHouseholdBillingCycleStartDay(supabase: ServerSupabase, ownerId: string) {
  const { data, error } = await supabase
    .from('household_billing_settings')
    .select('cycle_start_day')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throw new Error(`לא ניתן לטעון את הגדרות מחזור החיוב: ${error.message}`);
  return data?.cycle_start_day ?? DEFAULT_BILLING_CYCLE_START_DAY;
}
