'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, User, LogOut, Check, Plus, Settings, Calendar } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { getHouseholdMembers, inviteHouseholdMember, HouseholdMember } from '@/actions/members';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [activePayer, setActivePayer] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  const loadMembers = useCallback(async () => {
    const list = await getHouseholdMembers();
    setMembers(list);

    const savedPayer = typeof window !== 'undefined' ? localStorage.getItem('default_payer') : null;
    if (savedPayer && list.some((m) => m.name === savedPayer)) {
      setActivePayer(savedPayer);
    } else if (list.length > 0) {
      setActivePayer(list[0].name);
      localStorage.setItem('default_payer', list[0].name);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (isMounted && data?.user) {
        setUserEmail(data.user.email ?? 'משתמש');
      }
      if (isMounted) {
        await loadMembers();
      }
    }
    init();
    return () => { isMounted = false; };
  }, [loadMembers]);

  const handlePayerChange = (name: string) => {
    setActivePayer(name);
    localStorage.setItem('default_payer', name);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviteError('');
      await inviteHouseholdMember(inviteEmail);
      setInviteEmail('');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'שגיאה בשליחת ההזמנה');
      return;
    }

    setShowAddInput(false);
    await loadMembers();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setSigningOut(false);
      setInviteError('לא ניתן להתנתק כרגע. נסו שוב.');
      return;
    }

    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="relative">
      {/* Hamburger Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center bg-retro-yellow text-retro-border p-2 rounded-xl border-[3px] border-retro-border shadow-[2px_2px_0px_0px_#1F2937] hover:scale-105 active:scale-95 transition-all"
        title="תפריט"
      >
        <Menu size={24} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-72 bg-white border-[3px] border-retro-border rounded-2xl shadow-retro-lg z-50 p-4 space-y-4 animate-in fade-in zoom-in-95 dir-rtl">
            
            {/* User Info */}
            <div className="bg-slate-50 p-2.5 rounded-xl border-2 border-retro-border flex items-center gap-3">
              <div className="bg-retro-yellow p-1.5 rounded-lg border-2 border-retro-border">
                <User size={16} className="text-retro-border" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-black text-retro-border/60">מחובר כעת</p>
                <p className="text-xs font-black text-retro-border truncate">{userEmail || 'טוען...'}</p>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors text-right border-2 border-transparent hover:border-retro-border/20">
                <Calendar size={16} className="text-retro-border" />
                <span className="text-sm font-bold text-retro-border">ממוצע שנתי</span>
              </button>
              <button className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors text-right border-2 border-transparent hover:border-retro-border/20">
                <Settings size={16} className="text-retro-border" />
                <span className="text-sm font-bold text-retro-border">הגדרות חשבון</span>
              </button>
            </div>

            <hr className="border-retro-border/20 border-2 rounded-full" />

            {/* Payer Management */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black text-retro-border">מי מזין הוצאות?</label>
                <button
                  onClick={() => setShowAddInput(!showAddInput)}
                  className="text-[10px] font-black text-retro-border underline flex items-center gap-0.5"
                >
                  <Plus size={12} /> הוסף משתמש
                </button>
              </div>

              {showAddInput && (
                <form onSubmit={handleAddMember} className="flex gap-1 mb-2">
                  <input
                    type="email"
                    required
                    placeholder="אימייל של המשתמש..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full p-1.5 bg-slate-50 border-2 border-retro-border rounded-lg text-xs font-bold outline-none"
                  />
                  <button type="submit" className="px-2 bg-retro-green border-2 border-retro-border rounded-lg text-xs font-black">
                    שמור
                  </button>
                </form>
              )}

              {inviteError && <p className="text-[10px] font-bold text-retro-terracotta mb-2">{inviteError}</p>}

              <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-1">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handlePayerChange(m.name)}
                    className={`py-2 px-2 rounded-xl text-xs font-black border-2 border-retro-border flex items-center justify-center gap-1 transition-all ${
                      activePayer === m.name
                        ? 'bg-retro-yellow text-retro-border shadow-[2px_2px_0px_0px_#1F2937]'
                        : 'bg-white text-retro-border/60 hover:bg-slate-50'
                    }`}
                  >
                    {activePayer === m.name && <Check size={12} />}
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-retro-border/20 border-2 rounded-full" />

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-2 bg-retro-terracotta text-white font-black text-sm border-[3px] border-retro-border rounded-xl shadow-[2px_2px_0px_0px_#1F2937] flex items-center justify-center gap-2 hover:bg-retro-terracotta/90 active:translate-y-0.5 transition-all"
            >
              <LogOut size={16} /> {signingOut ? 'מתנתק...' : 'התנתק מהמערכת'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}