'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';

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

  const { data, error } = await supabase
    .from('household_members')
    .select('id, name, email')
    .eq('user_id', authData.user.id)
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
      .insert(defaults.map((m) => ({ name: m.name, user_id: authData.user.id })))
      .select('id, name, email');

    return seeded || [];
  }

  return data;
}

/**
 * Add a local payer label. This does not share data with another account.
 */
export async function inviteHouseholdMember(email: string) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    throw new Error('חובה להתחבר למערכת כדי להוסיף משתמש');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  const { error } = await supabase.from('household_members').insert({
    user_id: authData.user.id,
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