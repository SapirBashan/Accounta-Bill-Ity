'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';

export type HouseholdMember = {
  id: string;
  name: string;
  email?: string | null;
  isHouseholdMember?: boolean;
};

/**
 * Fetch household members for the authenticated user
 */
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) return [];

  const { data, error } = await supabase.rpc('get_household_members') as {
    data: HouseholdMember[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error('Error fetching members:', error.message);
    return [];
  }

  const currentEmail = authData.user.email?.trim().toLowerCase();
  const { data: ownMembership } = currentEmail
    ? await supabase
      .from('household_members')
      .select('id')
      .eq('email', currentEmail)
      .maybeSingle()
    : { data: null };
  const emailMembers = (data || []).filter((member) => member.email);

  if (currentEmail && !emailMembers.some((member) => member.email?.toLowerCase() === currentEmail)) {
    emailMembers.unshift({
      id: `current-${authData.user.id}`,
        name: currentEmail,
      email: currentEmail,
    });
  }

  return emailMembers.map((member) => ({
    ...member,
      isHouseholdMember: member.id === ownMembership?.id,
      name: member.email?.split('@')[0] || member.name,
  }));
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