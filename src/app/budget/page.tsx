'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy, CheckCircle2, Plus, Minus } from 'lucide-react';
import {
  getCategoryCatalog,
  getMonthlyBudgets,
  updateCategoryBudget,
  copyLastMonthBudgets,
  setCategoryActive,
  createCategory,
  reorderCategories,
} from '@/actions/budget';
import SortableCategoryList from '@/components/SortableCategoryList';
import CategoryCard from '@/components/CategoryCard';

type BudgetItem = {
  category_id: string;
  category_name: string;
  group_name: string;
  type: string;
  planned_amount: number;
};

type CategoryOption = {
  id: string;
  name: string;
  group_name: string;
  type: string;
  active: boolean;
};

export default function BudgetPlanningPage() {
  const searchParams = useSearchParams();
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true); // Automatically true on first load
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [categoryCatalog, setCategoryCatalog] = useState<CategoryOption[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryGroup, setNewCategoryGroup] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'fixed_expense' | 'variable_expense'>('variable_expense');
  const [categoryError, setCategoryError] = useState('');

  const selectedMonth = searchParams.get('month');
  const currentMonth = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
    ? selectedMonth
    : new Date().toISOString().slice(0, 7);

  // 1. Standalone fetch function (No useCallback needed)
  const fetchBudgets = async () => {
    const [budgetData, catalogData] = await Promise.all([
      getMonthlyBudgets(currentMonth),
      getCategoryCatalog(),
    ]);
    const hiddenIds = JSON.parse(localStorage.getItem('hidden_category_ids') || '[]') as string[];
    setBudgets((budgetData as BudgetItem[]).filter((item) => !hiddenIds.includes(item.category_id)));
    setCategoryCatalog((catalogData as CategoryOption[])
      .filter((category) => category.type !== 'income')
      .map((category) => ({
      ...category,
      active: !hiddenIds.includes(category.id) && category.active,
      })));
    setLoading(false); // Async setState is perfectly fine
  };

  // 2. Simple useEffect without synchronous state updates
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleReorder = async (items: BudgetItem[]) => {
    const reorderedById = new Map(items.map((item) => [item.category_id, item]));
    setBudgets((previous) => {
      let reorderedIndex = 0;
      return previous.map((item) => {
        if (!reorderedById.has(item.category_id)) return item;
        const nextItem = items[reorderedIndex++];
        return nextItem || item;
      });
    });
    await reorderCategories(items.map((item) => item.category_id));
  };

  const handleCategoryToggle = async (categoryId: string, active: boolean) => {
    await setCategoryActive(categoryId, active);
    const storedIds = JSON.parse(localStorage.getItem('hidden_category_ids') || '[]') as string[];
    const nextHiddenIds = active
      ? storedIds.filter((id) => id !== categoryId)
      : storedIds.includes(categoryId) ? storedIds : [...storedIds, categoryId];
    localStorage.setItem('hidden_category_ids', JSON.stringify(nextHiddenIds));
    setCategoryCatalog((prev) =>
      prev.map((category) => (category.id === categoryId ? { ...category, active } : category))
    );
    setBudgets((previous) => active
      ? previous
      : previous.filter((item) => item.category_id !== categoryId));
    await fetchBudgets();
  };

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategoryError('');
    try {
      await createCategory(newCategoryName, newCategoryGroup, newCategoryType);
      setNewCategoryName('');
      setNewCategoryGroup('');
      await fetchBudgets();
      setCategoryCatalog((await getCategoryCatalog() as CategoryOption[])
        .filter((category) => category.type !== 'income'));
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'לא ניתן להוסיף קטגוריה');
    }
  };

  const handleCopyLastMonth = async () => {
    setLoading(true); // Allowed here because it's inside an event handler
    await copyLastMonthBudgets(currentMonth);
    await fetchBudgets();
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const totalPlanned = budgets
    .filter((item) => item && item.type !== 'income')
    .reduce((sum, item) => sum + (Number(item.planned_amount) || 0), 0);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-retro-border">תקציב</h1>
          <p className="text-xs font-bold text-retro-border/70 mt-0.5">יעדים, הכנסות וקטגוריות</p>
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

      <div>
      <div className="bg-retro-green border-[3px] border-retro-border rounded-2xl p-3 shadow-retro flex justify-between items-center">
        <span className="font-black text-sm text-retro-border">סה&quot;כ הוצאות מתוכננות:</span>
        <span className="text-2xl font-black text-retro-border" dir="ltr">
          ₪{totalPlanned.toLocaleString()}
        </span>
      </div>
      </div>

      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-base text-retro-border">הוצאות</h3>
          <span className="text-xs font-bold text-retro-border/50">הגדר יעד</span>
        </div>

        {loading ? (
          <p className="text-center py-4 font-bold text-retro-border/50">טוען נתוני תקציב...</p>
        ) : (
          <SortableCategoryList
            items={budgets.filter((item) => item.type !== 'income')}
            onReorder={handleReorder}
            getId={(item) => item.category_id}
          >
            {(item) => (
              <CategoryCard
                name={item.category_name}
                groupName={item.group_name}
                plannedAmount={item.planned_amount}
                onBudgetChange={(value) => handleBudgetChange(item.category_id, value)}
                onBudgetBlur={() => handleSaveAmount(item.category_id, item.planned_amount)}
              />
            )}
          </SortableCategoryList>
        )}
      </div>

      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro space-y-3">
        <div>
          <h3 className="font-black text-base text-retro-border">ניהול קטגוריות</h3>
          <p className="text-xs font-bold text-retro-border/60 mt-0.5">הוסף קטגוריה אישית או הסר קטגוריה מהרשימה.</p>
        </div>
        <form onSubmit={handleCreateCategory} className="grid gap-2 border-b-2 border-retro-border/20 pb-3">
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="שם קטגוריה חדשה"
            required
            className="w-full p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
          />
          <input
            value={newCategoryGroup}
            onChange={(event) => setNewCategoryGroup(event.target.value)}
            placeholder="קבוצה, למשל ילדים או בריאות"
            required
            className="w-full p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
          />
          <div className="flex gap-2">
            <select
              value={newCategoryType}
              onChange={(event) => setNewCategoryType(event.target.value as typeof newCategoryType)}
              className="min-w-0 flex-1 p-2 bg-white border-2 border-retro-border rounded-lg font-bold outline-none"
            >
              <option value="variable_expense">הוצאה משתנה</option>
              <option value="fixed_expense">הוצאה קבועה</option>
            </select>
            <button type="submit" className="px-3 bg-retro-green border-2 border-retro-border rounded-lg font-black">
              <Plus size={16} />
            </button>
          </div>
          {categoryError && <p className="text-xs font-bold text-retro-terracotta">{categoryError}</p>}
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {categoryCatalog.map((category) => (
          <div key={category.id} className="flex justify-between items-center gap-2 p-2 bg-retro-bg border-2 border-retro-border rounded-xl">
            <div>
              <h4 className="font-black text-sm text-retro-border">{category.name}</h4>
              <span className="text-[10px] font-bold text-retro-border/60">
                {category.group_name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCategoryToggle(category.id, !category.active)}
              className={`flex shrink-0 items-center gap-1 px-2 py-1.5 border-2 border-retro-border rounded-lg font-black text-xs ${
                category.active ? 'bg-retro-terracotta/20' : 'bg-retro-green/30'
              }`}
            >
              {category.active ? <Minus size={14} /> : <Plus size={14} />}
              {category.active ? 'הסר' : 'הוסף'}
            </button>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}