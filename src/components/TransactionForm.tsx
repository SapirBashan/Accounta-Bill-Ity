'use client';

import { useState } from 'react';
import { Category } from '@/types';
import { addTransaction } from '@/actions/transactions';

interface TransactionFormProps {
  categories: Category[];
}

export default function TransactionForm({ categories }: TransactionFormProps) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [userName, setUserName] = useState<'ספיר' | 'עמליה'>('ספיר');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId) return;

    setLoading(true);
    setMessage('');

    try {
      await addTransaction({
        category_id: categoryId,
        amount: parseFloat(amount),
        date,
        user_name: userName,
        notes,
      });

      setMessage('✅ הרישום בוצע בהצלחה!');
      setAmount('');
      setNotes('');
    } catch (err) {
      setMessage('❌ שגיאה בשמירת הנתונים');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full p-3 border-2 border-retro-border rounded-xl outline-none bg-white font-medium text-retro-border transition-all focus:-translate-y-1 focus:shadow-[4px_4px_0px_0px_#1F2937]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-black mb-2 text-retro-border">מי משלם?</label>
        <div className="grid grid-cols-2 gap-3">
          {(['ספיר', 'עמליה'] as const).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setUserName(name)}
              className={`py-3 rounded-xl font-black border-2 border-retro-border transition-all ${
                userName === name
                  ? 'bg-retro-yellow text-retro-border shadow-[3px_3px_0px_0px_#1F2937] -translate-y-1'
                  : 'bg-white/60 text-retro-border/60 hover:bg-white'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-black mb-1 text-retro-border">סכום (₪)</label>
        <input
          type="number"
          step="0.01"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClasses} text-2xl font-black text-left`}
          dir="ltr"
        />
      </div>

      <div>
        <label className="block text-sm font-black mb-1 text-retro-border">קטגוריה</label>
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClasses}
        >
          <option value="">בחר קטגוריה...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.group_name} - {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-black mb-1 text-retro-border">תאריך</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClasses}
        />
      </div>

      <div>
        <label className="block text-sm font-black mb-1 text-retro-border">הערה (אופציונלי)</label>
        <input
          type="text"
          placeholder="למשל: קניות לשבת, דלק וכו'"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClasses}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 py-4 bg-retro-green text-retro-border font-black text-lg border-2 border-retro-border rounded-xl shadow-retro hover:-translate-y-1 hover:shadow-retro-lg active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'שומר...' : 'שמור תנועה'}
      </button>

      {message && (
        <div className="text-center font-bold text-retro-border bg-white border-2 border-retro-border rounded-xl p-3 shadow-retro-sm">
          {message}
        </div>
      )}
    </form>
  );
}