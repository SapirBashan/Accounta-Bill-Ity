'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getHouseholdOwnerId } from '@/lib/household';

export type HouseholdMember = {
  id: string;
  name: string;
  email?: string | null;
};

/**
 * Fetch household members for the authenticated user
 */
export async function getHouseholdMembers(): Promise<HouseholdMember[]> {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) return [];
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);

  const { data, error } = await supabase
    .from('household_members')
    .select('id, name, email')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching members:', error.message);
    return [];
  }

  // Seed initial defaults if account has no members yet
  if (!data || data.length === 0) {
    const defaults = [{ name: 'משתמש 1' }, { name: 'משתמש 2' }];
    const { data: seeded } = await supabase
      .from('household_members')
      .insert(defaults.map((m) => ({ name: m.name, user_id: ownerId })))
      .select('id, name, email');

    return seeded || [];
  }

  return data;
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
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const { error } = await supabase.from('household_members').insert({
    user_id: ownerId,
    name: normalizedEmail.split('@')[0],
    email: normalizedEmail,
  });

  if (error) {
    console.error('Failed to add member:', error.message);
    throw new Error('לא ניתן לשלוח את ההזמנה. בדקו את כתובת האימייל ונסו שוב.');
  }

  revalidatePath('/add');
  revalidatePath('/');
}