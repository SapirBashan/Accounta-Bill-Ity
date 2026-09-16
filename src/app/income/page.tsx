'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Minus, Plus, WalletCards } from 'lucide-react';
import { addIncome, getIncomePageData } from '@/actions/transactions';
import { createCategory, setCategoryActive } from '@/actions/budget';

type IncomeCategory = {
  id: string;
  name: string;
  group_name: string;
};

type IncomeTransaction = {
  id: string;
  amount: number;
  date: string;
  user_name: string;
  notes?: string;
  category_name: string;
};

function IncomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedMonth = searchParams.get('month');
  const currentMonth = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
    ? selectedMonth
    : new Date().toISOString().slice(0, 7);
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [transactions, setTransactions] = useState<IncomeTransaction[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceError, setSourceError] = useState('');

  const loadData = async () => {
    const data = await getIncomePageData(currentMonth);
    const hiddenIds = JSON.parse(localStorage.getItem('hidden_category_ids') || '[]') as string[];
    setCategories(data.categories.filter((category) => !hiddenIds.includes(category.id)));
    setTransactions(data.transactions as IncomeTransaction[]);
    setCategoryId((previous) => previous || data.categories[0]?.id || '');
  };

  useEffect(() => {
    // Load the selected month whenever the shared month selector changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const totalIncome = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryId || !amount) return;
    setSaving(true);
    setError('');
    try {
      await addIncome(categoryId, Number(amount), `${currentMonth}-01`, notes || undefined);
      setAmount('');
      setNotes('');
      await loadData();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'לא ניתן להוסיף הכנסה');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSource = async (event: React.FormEvent) => {
    event.preventDefault();
    setSourceError('');
    try {
      await createCategory(sourceName, 'הכנסות', 'income');
      setSourceName('');
      await loadData();
    } catch (submitError) {
      setSourceError(submitError instanceof Error ? submitError.message : 'לא ניתן להוסיף מקור הכנסה');
    }
  };

  const handleRemoveSource = async (categoryId: string) => {
    await setCategoryActive(categoryId, false);
    const storedIds = JSON.parse(localStorage.getItem('hidden_category_ids') || '[]') as string[];
    if (!storedIds.includes(categoryId)) {
      localStorage.setItem('hidden_category_ids', JSON.stringify([...storedIds, categoryId]));
    }
    await loadData();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-retro-border flex items-center gap-2">
          <WalletCards size={24} /> הכנסות
        </h1>
        <p className="text-xs font-bold text-retro-border/70 mt-1">ניהול הכנסות לחודש הנבחר</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-retro-green border-[3px] border-retro-border rounded-2xl p-3 shadow-retro">
          <p className="text-xs font-black text-retro-border/70">הכנסות בפועל</p>
          <p className="text-2xl font-black text-retro-border" dir="ltr">₪{totalIncome.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
        <h2 className="font-black text-base text-retro-border mb-3">הוספת הכנסה</h2>
        {categories.length === 0 ? (
          <p className="text-sm font-bold text-retro-border/60">הוסף מקור הכנסה באזור ניהול המקורות.</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-2">
            <label className="text-xs font-black text-retro-border">קטגוריה</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
            >
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <label className="text-xs font-black text-retro-border">סכום</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
              dir="ltr"
            />
            <label className="text-xs font-black text-retro-border">הערה</label>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
            />
            <button type="submit" disabled={saving} className="w-full py-2 bg-retro-green border-2 border-retro-border rounded-lg font-black flex justify-center gap-2">
              <Plus size={18} /> {saving ? 'שומר...' : 'הוסף הכנסה'}
            </button>
            {error && <p className="text-xs font-bold text-retro-terracotta">{error}</p>}
          </form>
        )}
      </div>

      <div className="bg-retro-yellow border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div>
          <h2 className="font-black text-base text-retro-border">מקורות הכנסה</h2>
          <p className="text-xs font-bold text-retro-border/60">ניהול מקורות ההכנסה מתבצע כאן בלבד.</p>
        </div>
        <form onSubmit={handleAddSource} className="flex gap-2">
          <input
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="שם מקור חדש"
            required
            className="min-w-0 flex-1 p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
          />
          <button type="submit" className="px-3 bg-retro-green border-2 border-retro-border rounded-lg font-black">
            <Plus size={16} />
          </button>
        </form>
        {categories.map((category) => (
          <div key={category.id} className="flex justify-between items-center gap-2 p-2 bg-white border-2 border-retro-border rounded-xl">
            <div>
              <p className="font-black text-sm">{category.name}</p>
              <p className="text-[10px] font-bold text-retro-border/60">{category.group_name}</p>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveSource(category.id)}
              className="flex items-center gap-1 px-2 py-1.5 border-2 border-retro-border rounded-lg font-black text-xs bg-retro-terracotta/20"
            >
              <Minus size={14} /> הסר
            </button>
          </div>
        ))}
        {sourceError && <p className="text-xs font-bold text-retro-terracotta">{sourceError}</p>}
      </div>

      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-2">
        <h2 className="font-black text-base text-retro-border">הכנסות החודש</h2>
        {transactions.length === 0 ? (
          <p className="text-sm font-bold text-retro-border/60 py-4 text-center">אין הכנסות עדיין.</p>
        ) : transactions.map((transaction) => (
          <div key={transaction.id} className="flex justify-between items-center border-b border-retro-border/10 pb-2 last:border-0">
            <div>
              <p className="font-black text-sm">{transaction.notes || transaction.category_name}</p>
              <p className="text-xs font-bold text-retro-border/50">{transaction.category_name} · {transaction.user_name}</p>
            </div>
            <p className="font-black text-retro-green" dir="ltr">+₪{transaction.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IncomePage() {
  return (
    <Suspense fallback={<div className="py-8 text-center font-bold text-retro-border/50">טוען...</div>}>
      <IncomePageContent />
    </Suspense>
  );
}