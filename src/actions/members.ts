'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export type HouseholdMember = {
  id: string;
  name: string;
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
    .select('id, name')
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
      .select('id, name');

    return seeded || [];
  }

  return data;
}

/**
 * Add a new custom household member/payer
 */
export async function addHouseholdMember(name: string) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData?.user) {
    throw new Error('חובה להתחבר למערכת כדי להוסיף משתמש');
  }

  if (!name.trim()) return;

  const { error } = await supabase.from('household_members').insert({
    user_id: authData.user.id,
    name: name.trim(),
  });

  if (error) {
    console.error('Failed to add member:', error.message);
    throw new Error(error.message);
  }

  revalidatePath('/add');
  revalidatePath('/');
}