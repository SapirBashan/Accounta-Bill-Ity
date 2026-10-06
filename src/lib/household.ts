import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export type HouseholdMember = {
  id: string;
  name: string;
  email?: string | null;
  isHouseholdMember?: boolean;
};

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

export async function getHouseholdMembersForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<HouseholdMember[]> {
  const currentEmail = user.email?.trim().toLowerCase();
  const [{ data, error }, { data: ownMembership }] = await Promise.all([
    supabase.rpc('get_household_members') as unknown as Promise<{
      data: HouseholdMember[] | null;
      error: { message: string } | null;
    }>,
    currentEmail
      ? supabase
        .from('household_members')
        .select('id')
        .eq('email', currentEmail)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (error) {
    console.error('Error fetching members:', error.message);
    return [];
  }
  const emailMembers = (data || []).filter((member) => member.email);

  if (currentEmail && !emailMembers.some((member) => member.email?.toLowerCase() === currentEmail)) {
    emailMembers.unshift({
      id: `current-${user.id}`,
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
