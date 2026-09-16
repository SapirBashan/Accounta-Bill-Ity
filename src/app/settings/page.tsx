'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, FileSpreadsheet, LogOut, Moon, Palette, Save, Shield, Sun, Upload, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import * as XLSX from 'xlsx';
import { getHouseholdMembers, leaveHousehold, type HouseholdMember } from '@/actions/members';
import { getSpreadsheetExportData, importSpreadsheetData, type SpreadsheetMonth } from '@/actions/data';

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

  const parseAmount = (value: unknown) => {
    if (value === null || value === undefined || value === '' || String(value).includes('#')) return 0;
    const normalized = String(value).replace(/[₪,\s]/g, '').replace(/[()]/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.abs(amount) : 0;
  };

  const parseWorkbook = (file: File): Promise<SpreadsheetMonth[]> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array', raw: false });
        const months: SpreadsheetMonth[] = [];
        const monthNames = ['ינואר', 'פבואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        workbook.SheetNames.forEach((sheetName) => {
          const monthNumber = monthNames.findIndex((name) => sheetName.startsWith(name));
          if (monthNumber < 0 || sheetName === 'סיכום שנתי') return;
          const yearMatch = sheetName.match(/\.(\d{2})/);
          const year = yearMatch ? 2000 + Number(yearMatch[1]) : 2026;
          const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
          let fixedGroup = 'אחר';
          let variableGroup = 'אחר';
          const expenses: SpreadsheetMonth['expenses'] = [];
          let income = 0;
          rows.forEach((row) => {
            const fixedName = typeof row[0] === 'string' ? row[0].trim() : '';
            const variableName = typeof row[5] === 'string' ? row[5].trim() : '';
            const fixedHasNumbers = row[1] !== null && row[1] !== undefined && row[1] !== '';
            const variableHasNumbers = row[6] !== null && row[6] !== undefined && row[6] !== '';
            if (fixedName && !fixedHasNumbers && !/^סך|^סה/.test(fixedName)) fixedGroup = fixedName;
            if (variableName && !variableHasNumbers && !/^סך|^סה/.test(variableName)) variableGroup = variableName;
            if (fixedName && fixedHasNumbers && !/^סך|^סה|^הוצאות$|^תקציב$/.test(fixedName)) {
              expenses.push({ name: fixedName, groupName: fixedGroup, type: 'fixed_expense', budget: parseAmount(row[1]), spent: parseAmount(row[2]) });
            }
            if (variableName && variableHasNumbers && !/^סך|^סה|^הוצאות$|^תקציב$/.test(variableName)) {
              expenses.push({ name: variableName, groupName: variableGroup, type: 'variable_expense', budget: parseAmount(row[6]), spent: parseAmount(row[7]) });
            }
            const incomeName = typeof row[10] === 'string' ? row[10].trim() : '';
            if (incomeName && row[12] !== null && row[12] !== undefined && row[12] !== '' && !incomeName.startsWith('תזרים')) {
              income += parseAmount(row[12]);
            }
          });
          const deduped = new Map<string, SpreadsheetMonth['expenses'][number]>();
          expenses.forEach((expense) => {
            const key = `${expense.name}|${expense.groupName}|${expense.type}`;
            const previous = deduped.get(key);
            deduped.set(key, previous
              ? { ...expense, budget: Math.max(previous.budget, expense.budget), spent: previous.spent + expense.spent }
              : expense);
          });
          months.push({ month: `${year}-${String(monthNumber + 1).padStart(2, '0')}`, expenses: [...deduped.values()], income });
        });
        resolve(months);
      } catch (parseError) {
        reject(parseError);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('לא ניתן לקרוא את הקובץ'));
    reader.readAsArrayBuffer(file);
  });

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setDataBusy(true);
    setError('');
    setStatus('');
    try {
      const months = await parseWorkbook(file);
      if (months.length === 0) throw new Error('לא נמצאו גיליונות חודשיים בקובץ');
      const result = await importSpreadsheetData(months);
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
      const data = await getSpreadsheetExportData();
      const workbook = XLSX.utils.book_new();
      const sheets = [
        ['קטגוריות', data.categories],
        ['תקציבים', data.budgets],
        ['תנועות', data.transactions],
        ['משתמשים', data.members],
      ] as const;
      sheets.forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name));
      XLSX.writeFile(workbook, `accounta-bill-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
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
