'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, FileSpreadsheet, LogOut, Moon, Palette, Save, Shield, Sun, Upload, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { getHouseholdMembers, leaveHousehold, type HouseholdMember } from '@/actions/members';
import { getSpreadsheetExportFile, importSpreadsheetWorkbook } from '@/actions/data';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function getInitialDarkMode() {
  if (typeof window === 'undefined') return false;
  const savedTheme = localStorage.getItem('theme');
  return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dark = getInitialDarkMode();
    document.documentElement.classList.toggle('dark', dark);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(dark);
  }, []);

  useEffect(() => {
    async function loadAccount() {
      const [{ data: userData }, memberList] = await Promise.all([
        supabase.auth.getUser(),
        getHouseholdMembers(),
      ]);
      const user = userData.user;
      const name = typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';
      setEmail(user?.email || '');
      setDisplayName(name);
      setNewName(name);
      setMembers(memberList);
    }
    loadAccount();

    const refreshMembers = () => {
      if (document.visibilityState !== 'visible') return;
      getHouseholdMembers().then(setMembers);
    };
    const channel = supabase
      .channel('household-members-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members' }, refreshMembers)
      .subscribe();
    window.addEventListener('focus', refreshMembers);
    document.addEventListener('visibilitychange', refreshMembers);

    return () => {
      window.removeEventListener('focus', refreshMembers);
      document.removeEventListener('visibilitychange', refreshMembers);
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setIsDark(nextIsDark);
    localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextIsDark);
  };

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingName(true);
    setError('');
    setStatus('');
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: newName.trim() },
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setDisplayName(newName.trim());
      setStatus('השם נשמר בהצלחה');
    }
    setSavingName(false);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPassword(true);
    setError('');
    setStatus('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
    } else {
      setNewPassword('');
      setStatus('הסיסמה עודכנה בהצלחה');
    }
    setSavingPassword(false);
  };

  const leaveGroup = async () => {
    if (!window.confirm('לעזוב את הקבוצה? לא תראו יותר את הנתונים המשותפים.')) return;
    setLeaving(true);
    setError('');
    try {
      await leaveHousehold();
      router.replace('/');
      router.refresh();
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : 'לא ניתן לעזוב את הקבוצה');
      setLeaving(false);
    }
  };

  const resetPreferences = () => {
    localStorage.removeItem('hidden_category_ids');
    localStorage.removeItem('default_payer');
    setStatus('העדפות התצוגה אופסו');
    router.refresh();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDataBusy(true);
    setError('');
    setStatus('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const result = await importSpreadsheetWorkbook(btoa(binary));
      setStatus(`הייבוא הושלם: ${result.budgets} תקציבים ו-${result.transactions} תנועות`);
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'לא ניתן לייבא את הקובץ');
    } finally {
      setDataBusy(false);
    }
  };

  const handleExport = async () => {
    setDataBusy(true);
    setError('');
    try {
      const data = await getSpreadsheetExportFile();
      const binary = atob(data.content);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('הקובץ הורד בהצלחה');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'לא ניתן לייצא את הנתונים');
    } finally {
      setDataBusy(false);
    }
  };

  const currentMember = members.find((member) => member.email?.toLowerCase() === email.toLowerCase());
  const canLeaveGroup = Boolean(currentMember?.isHouseholdMember);

  return (
    <div className="space-y-4 pb-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 bg-white border-2 border-retro-border rounded-xl shadow-retro-sm"
          title="חזרה"
        >
          <ArrowRight size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-retro-border">הגדרות</h1>
          <p className="text-xs font-bold text-retro-border/60">ניהול החשבון והעדפות התצוגה</p>
        </div>
      </div>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div className="flex items-center gap-2">
          <UserRound size={19} />
          <h2 className="font-black">פרטי חשבון</h2>
        </div>
        <div className="bg-retro-bg border-2 border-retro-border rounded-xl p-3">
          <p className="text-[10px] font-black text-retro-border/60">אימייל</p>
          <p className="font-black break-all" dir="ltr">{email}</p>
        </div>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="שם לתצוגה"
            className="min-w-0 flex-1 p-2.5 bg-white border-2 border-retro-border rounded-xl font-bold outline-none"
          />
          <button type="submit" disabled={savingName} className="px-3 bg-retro-green border-2 border-retro-border rounded-xl font-black">
            <Save size={17} />
          </button>
        </form>
        {displayName && <p className="text-xs font-bold text-retro-border/60">מוצג כ: {displayName}</p>}
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={19} />
          <h2 className="font-black">נתוני חשבון</h2>
        </div>
        <p className="text-xs font-bold text-retro-border/60">הורד את כל הנתונים, או ייבא את קובץ התקציב החודשי.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={handleExport} disabled={dataBusy} className="flex items-center justify-center gap-1.5 p-2.5 bg-retro-green border-2 border-retro-border rounded-xl font-black text-sm">
            <Download size={16} /> הורדת Excel
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={dataBusy} className="flex items-center justify-center gap-1.5 p-2.5 bg-retro-yellow border-2 border-retro-border rounded-xl font-black text-sm">
            <Upload size={16} /> ייבוא Excel
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        {dataBusy && <p className="text-xs font-bold text-retro-border/60">מעבד נתונים...</p>}
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div className="flex items-center gap-2">
          <Shield size={19} />
          <h2 className="font-black">אבטחה</h2>
        </div>
        <form onSubmit={changePassword} className="space-y-2">
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="סיסמה חדשה"
            className="w-full p-2.5 bg-white border-2 border-retro-border rounded-xl font-bold outline-none"
            dir="ltr"
          />
          <button type="submit" disabled={savingPassword} className="w-full py-2.5 bg-retro-yellow border-2 border-retro-border rounded-xl font-black">
            {savingPassword ? 'שומר...' : 'שינוי סיסמה'}
          </button>
        </form>
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div className="flex items-center gap-2">
          <Palette size={19} />
          <h2 className="font-black">העדפות</h2>
        </div>
        <button type="button" onClick={toggleTheme} className="w-full flex items-center justify-between p-3 bg-retro-bg border-2 border-retro-border rounded-xl font-black">
          <span className="flex items-center gap-2">{isDark ? <Moon size={18} /> : <Sun size={18} />} מצב כהה</span>
          <span className="text-xs bg-white border border-retro-border rounded-lg px-2 py-1">{isDark ? 'פעיל' : 'כבוי'}</span>
        </button>
        <button type="button" onClick={resetPreferences} className="w-full p-3 bg-retro-bg border-2 border-retro-border rounded-xl font-black text-right">
          איפוס העדפות קטגוריות ותשלום
        </button>
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <h2 className="font-black">קבוצת הבית</h2>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <span key={member.id} className="bg-retro-yellow border-2 border-retro-border rounded-xl px-3 py-1.5 text-sm font-black">
              {member.name}
            </span>
          ))}
        </div>
        {canLeaveGroup ? (
          <button type="button" onClick={leaveGroup} disabled={leaving} className="w-full py-2.5 bg-retro-terracotta text-white border-2 border-retro-border rounded-xl font-black flex items-center justify-center gap-2">
            <LogOut size={17} /> {leaving ? 'יוצא...' : 'עזיבת הקבוצה'}
          </button>
        ) : (
          <p className="text-xs font-bold text-retro-border/60">אתה מנהל הקבוצה. כדי להסיר משתמש, מחק אותו מרשימת המשתמשים בתפריט הראשי.</p>
        )}
      </section>

      {(error || status) && (
        <div className={`p-3 border-2 border-retro-border rounded-xl text-sm font-black flex items-center gap-2 ${error ? 'bg-retro-terracotta/20' : 'bg-retro-green/30'}`}>
          {status && !error && <Check size={17} />}
          {error || status}
        </div>
      )}
    </div>
  );
}
