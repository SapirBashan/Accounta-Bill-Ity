'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getHouseholdMembersForUser, type HouseholdMember } from '@/lib/household';

export type { HouseholdMember } from '@/lib/household';

/**
 * Fetch household members for the authenticated user
 */
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) return [];
  return getHouseholdMembersForUser(supabase, authData.user);
}

/**
 * Add an email address to the current household.
 */
export async function inviteHouseholdMember(email: string) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    throw new Error('חובה להתחבר למערכת כדי להוסיף משתמש');
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const { error } = await supabase.rpc('invite_household_member', {
    p_email: normalizedEmail,
  });

  if (error) {
    console.error('Failed to add member:', error.message);
    throw new Error('לא ניתן לשלוח את ההזמנה. בדקו את כתובת האימייל ונסו שוב.');
  }

  revalidatePath('/add');
  revalidatePath('/');
}

export async function leaveHousehold() {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    throw new Error('חובה להתחבר למערכת כדי לעזוב קבוצה');
  }

  const { data: removed, error } = await supabase.rpc('leave_household');
  if (error) {
    throw new Error(error.message);
  }
  if (removed === false) {
    throw new Error('המשתמש אינו חבר בקבוצה');
  }

  revalidatePath('/');
  revalidatePath('/settings');
}