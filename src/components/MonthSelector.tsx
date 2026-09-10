'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export default function MonthSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // משיכת החודש מה-URL או ברירת מחדל לחודש הנוכחי
  const currentParam = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const [yearStr, monthStr] = currentParam.split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const monthIndex = (parseInt(monthStr, 10) || 9) - 1;

  const updateMonth = (newYear: number, newMonthIdx: number) => {
    let adjustedYear = newYear;
    let adjustedMonthIdx = newMonthIdx;

    if (adjustedMonthIdx > 11) {
      adjustedMonthIdx = 0;
      adjustedYear += 1;
    } else if (adjustedMonthIdx < 0) {
      adjustedMonthIdx = 11;
      adjustedYear -= 1;
    }

    const formattedMonth = String(adjustedMonthIdx + 1).padStart(2, '0');
    const monthQuery = `${adjustedYear}-${formattedMonth}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('month', monthQuery);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1 bg-retro-terracotta text-white font-black text-xs px-2 py-1 rounded-xl border-2 border-retro-border shadow-[2px_2px_0px_0px_#1F2937]">
      {/* חודש קודם */}
      <button
        onClick={() => updateMonth(year, monthIndex - 1)}
        className="p-1 hover:bg-black/20 rounded-lg transition-colors active:scale-95"
        title="חודש קודם"
      >
        <ChevronRight size={16} />
      </button>

      {/* תצוגת חודש ושנה */}
      <span className="px-1 min-w-[78px] text-center select-none font-black">
        {HEBREW_MONTHS[monthIndex]} {year}
      </span>

      {/* חודש הבא */}
      <button
        onClick={() => updateMonth(year, monthIndex + 1)}
        className="p-1 hover:bg-black/20 rounded-lg transition-colors active:scale-95"
        title="חודש הבא"
      >
        <ChevronLeft size={16} />
      </button>
    </div>
  );
}