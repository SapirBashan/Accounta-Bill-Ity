'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu, User, LogOut, Check, Plus, Settings, Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { getHouseholdMembers, inviteHouseholdMember, HouseholdMember } from '@/actions/members';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export default function HeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [activePayer, setActivePayer] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [showAddInput, setShowAddInput] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Month Selector States
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState<number>(selectedMonth);
  const [tempYear, setTempYear] = useState<number>(selectedYear);

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
    if (!isOpen) return;
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
    const refreshMembers = () => {
      if (document.visibilityState === 'visible') loadMembers();
    };
    const channel = supabase
      .channel('household-members-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, refreshMembers)
      .subscribe();
    window.addEventListener('focus', refreshMembers);
    document.addEventListener('visibilitychange', refreshMembers);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshMembers);
      document.removeEventListener('visibilitychange', refreshMembers);
      supabase.removeChannel(channel);
    };
  }, [isOpen, loadMembers]);

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

  const openMonthPicker = () => {
    setTempMonth(selectedMonth);
    setTempYear(selectedYear);
    setIsMonthModalOpen(true);
  };

  const handleConfirmMonth = () => {
    setSelectedMonth(tempMonth);
    setSelectedYear(tempYear);
    setIsMonthModalOpen(false);
    setIsOpen(false);
    // You can trigger page re-fetch or state update here for the dashboard
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

      {/* Main Hamburger Dropdown */}
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
              <button 
                onClick={openMonthPicker}
                className="w-full flex items-center justify-between p-2.5 bg-retro-yellow/30 hover:bg-retro-yellow border-2 border-retro-border rounded-xl transition-all text-right shadow-retro-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-retro-border" />
                  <span className="text-sm font-black text-retro-border">בחירת חודש</span>
                </div>
                <span className="text-xs font-black bg-white px-2 py-0.5 rounded-md border border-retro-border">
                  {HEBREW_MONTHS[selectedMonth]} {selectedYear}
                </span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg transition-colors text-right border-2 border-transparent hover:border-retro-border/20"
              >
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

      {/* Month Selector Retro Modal */}
      {isMonthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-retro-border/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-[4px] border-retro-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_#1F2937] w-full max-w-xs space-y-4 dir-rtl text-right">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b-2 border-retro-border/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-retro-yellow border-2 border-retro-border rounded-xl">
                  <Calendar size={18} className="text-retro-border" />
                </div>
                <h3 className="font-black text-base text-retro-border">בחירת חודש לתצוגה</h3>
              </div>
              <button
                onClick={() => setIsMonthModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-retro-border transition-all"
              >
                <X size={18} className="text-retro-border" />
              </button>
            </div>

            {/* Year Selector Control */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border-2 border-retro-border">
              <button
                type="button"
                onClick={() => setTempYear((y) => y - 1)}
                className="p-1 bg-white border-2 border-retro-border rounded-lg shadow-retro-sm hover:bg-retro-yellow active:translate-y-0.5 font-black transition-all"
              >
                <ChevronRight size={18} className="text-retro-border" />
              </button>
              <span className="font-black text-base text-retro-border">{tempYear}</span>
              <button
                type="button"
                onClick={() => setTempYear((y) => y + 1)}
                className="p-1 bg-white border-2 border-retro-border rounded-lg shadow-retro-sm hover:bg-retro-yellow active:translate-y-0.5 font-black transition-all"
              >
                <ChevronLeft size={18} className="text-retro-border" />
              </button>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {HEBREW_MONTHS.map((name, idx) => {
                const isSelected = tempMonth === idx;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTempMonth(idx)}
                    className={`py-2 px-1 text-xs font-black rounded-xl border-2 border-retro-border transition-all ${
                      isSelected
                        ? 'bg-retro-yellow text-retro-border shadow-[2px_2px_0px_0px_#1F2937] scale-105'
                        : 'bg-white text-retro-border/70 hover:bg-slate-50'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmMonth}
                className="flex-1 py-2.5 bg-retro-green text-retro-border font-black text-sm border-2 border-retro-border rounded-xl shadow-[2px_2px_0px_0px_#1F2937] hover:scale-[1.02] active:scale-95 transition-all"
              >
                אישור
              </button>
              <button
                type="button"
                onClick={() => setIsMonthModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 text-retro-border font-black text-sm border-2 border-retro-border rounded-xl hover:bg-slate-200 transition-all"
              >
                ביטול
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}