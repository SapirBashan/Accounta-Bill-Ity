import Link from 'next/link';
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { getYearSummary } from '@/actions/transactions';

const money = (amount: number) => `₪${Math.round(amount).toLocaleString('he-IL')}`;

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return <div className={`h-full rounded-sm ${className}`} style={{ width: `${Math.min(width, 100)}%` }} />;
}

function piePath(startAngle: number, endAngle: number) {
  const center = 50;
  const radius = 46;
  const start = (Math.PI * startAngle) / 180;
  const end = (Math.PI * endAngle) / 180;
  const startX = center + radius * Math.cos(start);
  const startY = center + radius * Math.sin(start);
  const endX = center + radius * Math.cos(end);
  const endY = center + radius * Math.sin(end);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export default async function YearSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const parsedYear = Number(params.year);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
    ? parsedYear
    : new Date().getFullYear();
  const summary = await getYearSummary(year);
  const chartMax = Math.max(...summary.months.flatMap((month) => [month.income, month.spent, month.budget]), 1);
  const categoryMax = Math.max(...summary.categories.map((category) => Math.max(category.spent, category.budget)), 1);
  const budgetUsage = summary.totalBudget > 0 ? Math.round((summary.totalSpent / summary.totalBudget) * 100) : 0;
  const monthlyAverage = {
    income: summary.totalIncome / 12,
    spent: summary.totalSpent / 12,
    budget: summary.totalBudget / 12,
    cashFlow: summary.cashFlow / 12,
  };
  const pieColors = ['#E07A5F', '#94A884', '#F4EA8A', '#6B8E9B', '#C98B7B', '#7D6B5D', '#A8B89A'];
  const pieTotal = summary.categories.reduce((total, category) => total + category.spent, 0);
  const pieSlices = summary.categories.filter((category) => category.spent > 0).reduce<Array<typeof summary.categories[number] & { startAngle: number; endAngle: number; color: string }>>((slices, category, index) => {
    const previousAngle = slices.at(-1)?.endAngle ?? -90;
    const sliceAngle = pieTotal > 0 ? (category.spent / pieTotal) * 360 : 0;
    return [...slices, {
      ...category,
      startAngle: previousAngle,
      endAngle: previousAngle + sliceAngle,
      color: pieColors[index % pieColors.length],
    }];
  }, []);

  return (
    <div className="space-y-4 pb-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-retro-border/60">מבט על כל השנה</p>
          <h1 className="text-2xl font-black text-retro-border">סיכום שנתי {year}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/summary?year=${year - 1}`}
            aria-label="השנה הקודמת"
            className="p-2 bg-white border-2 border-retro-border rounded-xl shadow-retro-sm"
          >
            <ArrowRight size={18} />
          </Link>
          <Link
            href={`/summary?year=${year + 1}`}
            aria-label="השנה הבאה"
            className="p-2 bg-white border-2 border-retro-border rounded-xl shadow-retro-sm"
          >
            <ArrowLeft size={18} />
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3" aria-label="סיכום שנתי">
        <div className="bg-retro-green/25 border-[3px] border-retro-border rounded-2xl p-3 shadow-retro">
          <div className="flex items-center gap-1 text-xs font-black text-retro-border/65"><TrendingUp size={15} /> הכנסות</div>
          <p className="mt-1 text-xl font-black" dir="ltr">{money(summary.totalIncome)}</p>
        </div>
        <div className="bg-retro-terracotta/20 border-[3px] border-retro-border rounded-2xl p-3 shadow-retro">
          <div className="flex items-center gap-1 text-xs font-black text-retro-border/65"><TrendingDown size={15} /> הוצאות</div>
          <p className="mt-1 text-xl font-black" dir="ltr">{money(summary.totalSpent)}</p>
        </div>
        <div className="bg-retro-yellow border-[3px] border-retro-border rounded-2xl p-3 shadow-retro">
          <div className="flex items-center gap-1 text-xs font-black text-retro-border/65"><Wallet size={15} /> חסכון</div>
          <p className="mt-1 text-xl font-black" dir="ltr">{money(summary.cashFlow)}</p>
        </div>
        <div className="bg-white border-[3px] border-retro-border rounded-2xl p-3 shadow-retro">
          <div className="flex items-center gap-1 text-xs font-black text-retro-border/65"><ChartNoAxesCombined size={15} /> ביצוע תקציב</div>
          <p className="mt-1 text-xl font-black" dir="ltr">{budgetUsage}%</p>
        </div>
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
        <div className="mb-3">
          <h2 className="text-lg font-black">ממוצע חודשי</h2>
          <p className="text-xs font-bold text-retro-border/55">ממוצע על פני 12 חודשי השנה</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-retro-green/20 rounded-xl p-2">
            <p className="text-[10px] font-black text-retro-border/60">הכנסה</p>
            <p className="font-black" dir="ltr">{money(monthlyAverage.income)}</p>
          </div>
          <div className="bg-retro-terracotta/15 rounded-xl p-2">
            <p className="text-[10px] font-black text-retro-border/60">הוצאה</p>
            <p className="font-black" dir="ltr">{money(monthlyAverage.spent)}</p>
          </div>
          <div className="bg-retro-yellow/60 rounded-xl p-2">
            <p className="text-[10px] font-black text-retro-border/60">תקציב</p>
            <p className="font-black" dir="ltr">{money(monthlyAverage.budget)}</p>
          </div>
          <div className="bg-retro-bg rounded-xl p-2">
            <p className="text-[10px] font-black text-retro-border/60">חסכון</p>
            <p className="font-black" dir="ltr">{money(monthlyAverage.cashFlow)}</p>
          </div>
        </div>
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black">תזרים חודשי</h2>
            <p className="text-xs font-bold text-retro-border/55">הכנסות, הוצאות ויעד התקציב</p>
          </div>
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[10px] font-black">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-retro-green" /> הכנסות</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-retro-terracotta" /> הוצאות</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-retro-yellow border border-retro-border" /> תקציב</span>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-1.5 items-end h-52 border-b-2 border-retro-border/20" dir="ltr">
          {summary.months.map((month) => (
            <div key={month.month} className="h-full min-w-0 flex flex-col justify-end gap-1 group">
              <div className="flex-1 flex items-end justify-center gap-px" title={`${month.label}: ${money(month.spent)} הוצאות`}>
                <Bar value={month.income} max={chartMax} className="bg-retro-green w-1/3" />
                <Bar value={month.spent} max={chartMax} className="bg-retro-terracotta w-1/3" />
                <Bar value={month.budget} max={chartMax} className="bg-retro-yellow border border-retro-border w-1/3" />
              </div>
              <span className="text-[9px] text-center font-black text-retro-border/65" dir="rtl">{month.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
        <div className="mb-3">
          <h2 className="text-lg font-black">התפלגות הוצאות</h2>
          <p className="text-xs font-bold text-retro-border/55">העבר את העכבר על פרוסה כדי לראות סכום ואחוז</p>
        </div>
        {pieSlices.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-retro-border/50 border-2 border-dashed border-retro-border/20 rounded-xl">
            אין הוצאות להצגה
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" className="w-40 h-40 shrink-0" role="img" aria-label="התפלגות הוצאות לפי קטגוריה">
              {pieSlices.map((slice) => (
                <path
                  key={slice.id}
                  d={piePath(slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  stroke="var(--color-retro-border)"
                  strokeWidth="0.8"
                >
                  <title>{`${slice.name}: ${money(slice.spent)} (${Math.round((slice.spent / pieTotal) * 100)}%)`}</title>
                </path>
              ))}
            </svg>
            <div className="min-w-0 space-y-1.5">
              {pieSlices.slice(0, 7).map((slice) => (
                <div key={slice.id} className="flex items-center gap-1.5 text-xs font-bold">
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.name}</span>
                  <span className="shrink-0 font-black" dir="ltr">{money(slice.spent)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
        <div className="mb-4">
          <h2 className="text-lg font-black">הוצאות לפי קטגוריה</h2>
          <p className="text-xs font-bold text-retro-border/55">השוואה בין הוצאה בפועל ליעד השנתי</p>
        </div>
        {summary.categories.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-retro-border/50 border-2 border-dashed border-retro-border/20 rounded-xl">
            אין נתונים לשנה הזו עדיין
          </div>
        ) : (
          <div className="space-y-4">
            {summary.categories.map((category) => (
              <div key={category.id}>
                <div className="flex justify-between items-center gap-3 mb-1 text-xs font-black">
                  <span className="truncate">{category.name}</span>
                  <span dir="ltr" className="shrink-0">{money(category.spent)} / {money(category.budget)}</span>
                </div>
                <div className="h-3 bg-retro-bg border border-retro-border rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <Bar value={category.spent} max={categoryMax} className="bg-retro-terracotta" />
                  </div>
                </div>
                <div className="mt-1 h-1.5 bg-retro-yellow/70 rounded-full" style={{ width: `${Math.min((category.budget / categoryMax) * 100, 100)}%` }} />
                <p className="text-[10px] font-bold text-retro-border/50 mt-0.5">{category.groupName}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
