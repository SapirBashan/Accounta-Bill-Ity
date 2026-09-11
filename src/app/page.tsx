

import {
  getCategoryCardSummaries,
  getDashboardSummary,
  getRecentTransactions,
  TransactionItem,
} from '@/actions/transactions';

type MainPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function MainPage({ searchParams }: MainPageProps) {
  const params = await searchParams;
  const selectedMonth = /^\d{4}-\d{2}$/.test(params.month || '')
    ? params.month as string
    : new Date().toISOString().slice(0, 7);
  const [summary, transactions, categorySummaries] = await Promise.all([
    getDashboardSummary(selectedMonth),
    getRecentTransactions(5, selectedMonth),
    getCategoryCardSummaries(selectedMonth),
  ]);
  const expenseCategories = categorySummaries.filter((category) => category.type !== 'income');
  const totalBudget = expenseCategories.reduce((total, category) => total + category.budget, 0);
  const totalBudgetSpent = expenseCategories.reduce((total, category) => total + category.spent, 0);
  const budgetPercent = totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0;
  const progressWidth = Math.min(budgetPercent, 100);
  const isOverBudget = budgetPercent > 100;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 dir-rtl">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-retro-border">לוח בקרה</h1>
        <p className="text-sm font-bold text-retro-border/60">סיכום התקציב שלך לחודש הנוכחי</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Income Card */}
        <div className="bg-retro-green/20 border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
          <p className="text-xs font-black text-retro-border/70 mb-1">הכנסות</p>
          <p className="text-2xl font-black text-retro-border">₪{summary.totalIncome}</p>
        </div>

        {/* Expenses Card */}
        <div className="bg-retro-terracotta/20 border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
          <p className="text-xs font-black text-retro-border/70 mb-1">הוצאות</p>
          <p className="text-2xl font-black text-retro-border">₪{summary.totalSpent}</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-retro-yellow border-[3px] border-retro-border rounded-2xl p-5 shadow-retro-lg flex justify-between items-center">
        <div>
          <p className="text-sm font-black text-retro-border/70">יתרה נוכחית</p>
          <p className="text-4xl font-black text-retro-border mt-1">₪{summary.monthlyCashFlow}</p>
        </div>
      </div>

      {/* Monthly budget status */}
      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-5 shadow-retro">
        <div className="flex justify-between items-start gap-3 mb-3">
          <div>
            <h2 className="text-lg font-black text-retro-border">סטטוס תקציב חודשי</h2>
            <p className="text-xs font-bold text-retro-border/60 mt-1">
              {isOverBudget ? 'חרגת מהתקציב החודשי' : 'ההוצאות שלך מתוך התקציב המתוכנן'}
            </p>
          </div>
          <span className={`text-xl font-black ${isOverBudget ? 'text-retro-terracotta' : 'text-retro-green'}`} dir="ltr">
            {budgetPercent}%
          </span>
        </div>

        <div className="h-4 w-full bg-retro-bg border-2 border-retro-border rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${isOverBudget ? 'bg-retro-terracotta' : 'bg-retro-green'}`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs font-black text-retro-border/70" dir="ltr">
          <span>₪{totalBudgetSpent.toLocaleString()}</span>
          <span>₪{totalBudget.toLocaleString()}</span>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-5 shadow-retro">
        <h2 className="text-lg font-black text-retro-border mb-3">פעילות אחרונה</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-sm font-bold text-retro-border/50 border-2 border-dashed border-retro-border/20 rounded-xl">
            אין נתונים להצגה עדיין
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction: TransactionItem) => (
              <div key={transaction.id} className="flex justify-between items-center border-b border-retro-border/10 pb-2 last:border-0">
                <div>
                  <p className="font-black text-sm">{transaction.notes || transaction.category?.name || 'תנועה'}</p>
                  <p className="text-xs font-bold text-retro-border/50">{transaction.user_name}</p>
                </div>
                <p className="font-black" dir="ltr">₪{transaction.amount}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}