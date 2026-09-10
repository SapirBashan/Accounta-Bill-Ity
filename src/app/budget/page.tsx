'use client';

import { useState, useEffect } from 'react';
import { Copy, CheckCircle2 } from 'lucide-react';
import { getMonthlyBudgets, updateCategoryBudget, copyLastMonthBudgets } from '@/actions/budget';

type BudgetItem = {
  category_id: string;
  category_name: string;
  group_name: string;
  planned_amount: number;
};

export default function BudgetPlanningPage() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true); // Automatically true on first load
  const [copiedMsg, setCopiedMsg] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  // 1. Standalone fetch function (No useCallback needed)
  const fetchBudgets = async () => {
    const data = await getMonthlyBudgets(currentMonth);
    setBudgets(data as BudgetItem[]);
    setLoading(false); // Async setState is perfectly fine
  };

  // 2. Simple useEffect without synchronous state updates
  useEffect(() => {
    fetchBudgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const handleBudgetChange = (id: string, value: string) => {
    const num = parseFloat(value) || 0;
    setBudgets((prev) =>
      prev.map((b) => (b.category_id === id ? { ...b, planned_amount: num } : b))
    );
  };

  const handleSaveAmount = async (categoryId: string, amount: number) => {
    await updateCategoryBudget(categoryId, currentMonth, amount);
  };

  const handleCopyLastMonth = async () => {
    setLoading(true); // Allowed here because it's inside an event handler
    await copyLastMonthBudgets(currentMonth);
    await fetchBudgets();
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const totalPlanned = budgets.reduce((sum, item) => sum + (Number(item.planned_amount) || 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-black text-retro-border">תכנון תקציב חודשי 📋</h1>
          <p className="text-xs font-bold text-retro-border/70 mt-0.5">קביעת היעדים וההוצאות הצפויות</p>
        </div>

        <button
          onClick={handleCopyLastMonth}
          className="flex items-center gap-1.5 bg-retro-yellow text-retro-border px-3 py-2 border-2 border-retro-border rounded-xl font-black text-xs shadow-retro active:translate-y-0.5 transition-all"
        >
          <Copy size={14} /> העתק מחודש שעבר
        </button>
      </div>

      {copiedMsg && (
        <div className="p-3 bg-retro-green/30 border-2 border-retro-border rounded-xl text-xs font-black text-retro-border flex items-center gap-2">
          <CheckCircle2 size={16} /> התקציב מהחודש הקודם הועתק בהצלחה!
        </div>
      )}

      <div className="bg-retro-green border-[3px] border-retro-border rounded-3xl p-4 shadow-retro flex justify-between items-center">
        <span className="font-black text-sm text-retro-border">סה"כ תקציב מתוכנן לחודש:</span>
        <span className="text-2xl font-black text-retro-border" dir="ltr">
          ₪{totalPlanned.toLocaleString()}
        </span>
      </div>

      <div className="bg-white border-[3px] border-retro-border rounded-3xl p-4 shadow-retro space-y-3">
        <h3 className="font-black text-base text-retro-border mb-2">פירוט קטגוריות</h3>

        {loading ? (
          <p className="text-center py-4 font-bold text-retro-border/50">טוען נתוני תקציב...</p>
        ) : (
          budgets.map((item) => (
            <div
              key={item.category_id}
              className="flex justify-between items-center p-2.5 bg-retro-bg border-2 border-retro-border rounded-xl"
            >
              <div>
                <h4 className="font-black text-sm text-retro-border">{item.category_name}</h4>
                <span className="text-[10px] font-bold text-retro-border/60">{item.group_name}</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={item.planned_amount}
                  onChange={(e) => handleBudgetChange(item.category_id, e.target.value)}
                  onBlur={() => handleSaveAmount(item.category_id, item.planned_amount)}
                  className="w-24 p-1.5 bg-white border-2 border-retro-border rounded-lg text-left font-black text-sm outline-none"
                  dir="ltr"
                />
                <span className="text-xs font-black text-retro-border">₪</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}