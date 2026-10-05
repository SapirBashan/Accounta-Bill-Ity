

import {
  getDashboardPageData,
  TransactionItem,
} from '@/actions/transactions';
import { getBillingCycleInfo } from '@/actions/billing-cycle';
import { isBillingMonth } from '@/lib/billing-cycle';

const PIE_COLORS = ['#E07A5F', '#94A884', '#F4EA8A', '#6B8E9B', '#C98B7B', '#7D6B5D', '#A8B89A'];

function piePath(startAngle: number, endAngle: number) {
  const center = 50;
  const radius = 48;
  const start = (Math.PI * startAngle) / 180;
  const end = (Math.PI * endAngle) / 180;
  const startX = center + radius * Math.cos(start);
  const startY = center + radius * Math.sin(start);
  const endX = center + radius * Math.cos(end);
  const endY = center + radius * Math.sin(end);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

type MainPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function MainPage({ searchParams }: MainPageProps) {
  const params = await searchParams;
  const { currentMonth } = await getBillingCycleInfo();
  const selectedMonth = isBillingMonth(params.month)
    ? params.month
    : currentMonth;
  const dashboardDataPromise = getDashboardPageData(selectedMonth);
  const currentMonthDataPromise = selectedMonth === currentMonth
    ? dashboardDataPromise
    : getDashboardPageData(currentMonth);
  const [{ summary, transactions, categorySummaries }, currentMonthData] = await Promise.all([
    dashboardDataPromise,
    currentMonthDataPromise,
  ]);
  const expenseCategories = categorySummaries.filter((category) => category.type !== 'income');
  const totalBudget = expenseCategories.reduce((total, category) => total + category.budget, 0);
  const totalBudgetSpent = expenseCategories.reduce((total, category) => total + category.spent, 0);
  const budgetPercent = totalBudget > 0 ? Math.round((totalBudgetSpent / totalBudget) * 100) : 0;
  const progressWidth = Math.min(budgetPercent, 100);
  const isOverBudget = budgetPercent > 100;
  const spendingCategories = currentMonthData.categorySummaries
    .filter((category) => category.type !== 'income' && category.spent > 0)
    .sort((left, right) => right.spent - left.spent);
  const pieTotal = spendingCategories.reduce((total, category) => total + category.spent, 0);
  const pieSlices = spendingCategories.reduce<Array<typeof spendingCategories[number] & {
    startAngle: number;
    endAngle: number;
    color: string;
  }>>((slices, category, index) => {
    const startAngle = slices.at(-1)?.endAngle ?? -90;
    const endAngle = startAngle + (category.spent / pieTotal) * 360;
    return [...slices, {
      ...category,
      startAngle,
      endAngle,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }];
  }, []);

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

      {/* Current month spending breakdown */}
      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-5 shadow-retro">
        <div className="mb-4">
          <h2 className="text-lg font-black text-retro-border">הוצאות לפי קטגוריה</h2>
          <p className="text-xs font-bold text-retro-border/60 mt-1">התפלגות ההוצאות בחודש הנוכחי, מהגבוה לנמוך</p>
        </div>
        {pieSlices.length === 0 ? (
          <div className="text-center py-6 text-sm font-bold text-retro-border/50 border-2 border-dashed border-retro-border/20 rounded-xl">
            אין הוצאות להצגה בחודש הזה
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg
                viewBox="0 0 100 100"
                className="w-48 h-48 max-w-full"
                role="img"
                aria-label={`התפלגות הוצאות לפי קטגוריה, סך הכל ₪${Math.round(pieTotal).toLocaleString('he-IL')}`}
              >
                {pieSlices.length === 1 ? (
                  <circle cx="50" cy="50" r="48" fill={pieSlices[0].color} stroke="#1F2937" strokeWidth="1.5" />
                ) : (
                  pieSlices.map((slice) => (
                    <path
                      key={slice.id}
                      d={piePath(slice.startAngle, slice.endAngle)}
                      fill={slice.color}
                      stroke="#1F2937"
                      strokeWidth="0.8"
                    />
                  ))
                )}
              </svg>
            </div>
            <p className="text-center text-sm font-black text-retro-border">
              סך הוצאות: ₪{Math.round(pieTotal).toLocaleString('he-IL')}
            </p>
            <ul className="grid grid-cols-1 gap-2">
              {pieSlices.map((slice) => (
                <li key={slice.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-bold text-retro-border">
                    <span className="h-3 w-3 shrink-0 rounded-sm border border-retro-border" style={{ backgroundColor: slice.color }} />
                    <span className="truncate">{slice.name}</span>
                  </span>
                  <span className="shrink-0 font-black text-retro-border" dir="ltr">
                    ₪{Math.round(slice.spent).toLocaleString('he-IL')} · {Math.round((slice.spent / pieTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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