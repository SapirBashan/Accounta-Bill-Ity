'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getHouseholdOwnerId } from '@/lib/household';
import {
  DEFAULT_BILLING_CYCLE_START_DAY,
  getCurrentBillingMonth,
} from '@/lib/billing-cycle';
import { getHouseholdBillingCycleStartDay } from '@/lib/billing-cycle-settings';

export async function getBillingCycleInfo() {
  const supabase = await getSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`לא ניתן לטעון את המשתמש: ${authError.message}`);
  if (!authData.user) {
    return {
      cycleStartDay: DEFAULT_BILLING_CYCLE_START_DAY,
      currentMonth: getCurrentBillingMonth(DEFAULT_BILLING_CYCLE_START_DAY),
    };
  }

  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const cycleStartDay = await getHouseholdBillingCycleStartDay(supabase, ownerId);
  return {
    cycleStartDay,
    currentMonth: getCurrentBillingMonth(cycleStartDay),
  };
}

export async function setBillingCycleStartDay(startDay: number) {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new Error('יש לבחור יום בין 1 ל-31');
  }

  const supabase = await getSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('חובה להתחבר כדי לשנות את מחזור החיוב');
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const { error } = await supabase
    .from('household_billing_settings')
    .upsert({ owner_id: ownerId, cycle_start_day: startDay }, { onConflict: 'owner_id' });

  if (error) throw new Error(`לא ניתן לשמור את מחזור החיוב: ${error.message}`);
  revalidatePath('/', 'layout');
}
