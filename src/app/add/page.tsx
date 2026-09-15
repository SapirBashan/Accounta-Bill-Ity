'use client';

import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addTransaction, getCategoryCardSummaries } from '@/actions/transactions';
import { getHouseholdMembers, HouseholdMember } from '@/actions/members';
import { reorderCategories } from '@/actions/budget';
import SortableCategoryList from '@/components/SortableCategoryList';
import CategoryCard from '@/components/CategoryCard';

type CategoryCard = {
  id: string;
  name: string;
  group_name: string;
  type: string;
  spent: number;
  budget: number;
};

export default function QuickAddPage() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<CategoryCard | null>(null);
  const [amount, setAmount] = useState('');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const selectedMonth = searchParams.get('month');
  const currentMonth = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
    ? selectedMonth
    : new Date().toISOString().slice(0, 7);
  const today = new Date();
  const currentSystemMonth = today.toISOString().slice(0, 7);
  const transactionDate = currentMonth === currentSystemMonth
    ? today.toISOString().split('T')[0]
    : `${currentMonth}-01`;

  useEffect(() => {
    async function loadData() {
      // 1. Load Category Summaries
      const cardData = await getCategoryCardSummaries(currentMonth);
      setCategories(cardData);

      // 2. Load Household Members
      const memberList = await getHouseholdMembers();
      setMembers(memberList);

      // 3. Set Default Selected Payer
      const savedPayer = localStorage.getItem('default_payer');
      if (savedPayer && memberList.some((m) => m.name === savedPayer)) {
        setUserName(savedPayer);
      } else if (memberList.length > 0) {
        setUserName(memberList[0].name);
      }
    }
    loadData();
  }, [currentMonth]);

  const filteredCategories = categories.filter(
    (c) => c.type !== 'income' && (c.name.includes(search) || c.group_name.includes(search))
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCat || !amount) return;

    setLoading(true);
    setErrorMessage('');

    try {
      await addTransaction({
        category_id: selectedCat.id,
        amount: parseFloat(amount),
        date: transactionDate,
        user_name: userName,
        notes: notes || selectedCat.name,
      });

      const updated = await getCategoryCardSummaries(currentMonth);
      setCategories(updated);
      router.refresh();

      setSelectedCat(null);
      setAmount('');
      setNotes('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'לא ניתן לשמור את התנועה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-retro-border">רישום מהיר ⚡</h1>
        <p className="text-xs font-bold text-retro-border/70">לחצו על קטגוריה להוספת הוצאה/הכנסה</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-3.5 text-retro-border/50" size={18} />
        <input
          type="text"
          placeholder="חפש קטגוריה (דלק, סופר, ארנונה...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-4 pr-10 py-3 bg-white border-2 border-retro-border rounded-2xl font-bold text-sm shadow-retro outline-none"
        />
      </div>

      {/* Category Grid */}
      <div className="pt-1">
        <SortableCategoryList
          items={filteredCategories}
          onReorder={async (items) => reorderCategories(items.map((item) => item.id))}
        >
          {(cat) => (
            <CategoryCard
              name={cat.name}
              groupName={cat.group_name}
              spent={cat.spent}
              budget={cat.budget}
              onSelect={() => setSelectedCat(cat)}
            />
          )}
        </SortableCategoryList>
      </div>

      {errorMessage && (
        <div className="bg-retro-terracotta/20 border-2 border-retro-border rounded-xl p-3 text-sm font-bold text-retro-border">
          {errorMessage}
        </div>
      )}

      {/* Quick Add Modal */}
      {selectedCat && (
        <div className="fixed inset-0 bg-retro-border/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-retro-bg border-[3px] border-retro-border rounded-3xl p-5 shadow-retro-lg w-full max-w-md animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-black text-lg text-retro-border">{selectedCat.name}</h3>
                <p className="text-xs font-bold text-retro-border/60">
                  הוצאת עד כה: ₪{selectedCat.spent} מתוך ₪{selectedCat.budget}
                </p>
              </div>
              <button
                onClick={() => setSelectedCat(null)}
                className="p-1.5 bg-white border-2 border-retro-border rounded-xl shadow-retro-sm"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Dynamic Payer Selection */}
              <div>
                <label className="block text-xs font-black text-retro-border mb-1">מי משלם?</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setUserName(m.name)}
                      className={`py-2.5 rounded-xl font-black text-xs border-2 border-retro-border transition-all ${
                        userName === m.name
                          ? 'bg-retro-yellow text-retro-border shadow-[2px_2px_0px_0px_#1F2937]'
                          : 'bg-white text-retro-border/60'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-retro-border mb-1">
                  סכום הוצאה (₪)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-retro-border rounded-xl text-2xl font-black outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-retro-border mb-1">הערה (אופציונלי)</label>
                <input
                  type="text"
                  placeholder="פירוט נוסף..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-retro-border rounded-xl text-sm font-bold outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-retro-green text-retro-border font-black border-2 border-retro-border rounded-xl shadow-retro hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
              >
                {loading ? 'שומר...' : 'אשר והוסף הוצאה'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}