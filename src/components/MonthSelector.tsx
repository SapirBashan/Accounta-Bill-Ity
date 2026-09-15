'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

interface MonthSelectorProps {
  currentMonth?: number; // 0-11
  currentYear?: number;
  onChange?: (month: number, year: number) => void;
}

export default function MonthSelector({
  currentMonth = new Date().getMonth(),
  currentYear = new Date().getFullYear(),
  onChange,
}: MonthSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedMonth = searchParams.get('month');
  const initialMonth = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
    ? Number(selectedMonth.slice(5, 7)) - 1
    : currentMonth;
  const initialYear = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
    ? Number(selectedMonth.slice(0, 4))
    : currentYear;
  const [month, setMonth] = useState<number>(initialMonth);
  const [year, setYear] = useState<number>(initialYear);

  // Modal temporary state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempMonth, setTempMonth] = useState<number>(month);
  const [tempYear, setTempYear] = useState<number>(year);

  const selectMonth = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
    onChange?.(newMonth, newYear);
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', `${newYear}-${String(newMonth + 1).padStart(2, '0')}`);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    selectMonth(newMonth, newYear);
  };

  const handleNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    selectMonth(newMonth, newYear);
  };

  const openModal = () => {
    setTempMonth(month);
    setTempYear(year);
    setIsModalOpen(true);
  };

  const handleConfirmModal = () => {
    setIsModalOpen(false);
    selectMonth(tempMonth, tempYear);
  };

  return (
    <>
      {/* Terracotta Retro Pill Selector */}
      <div className="inline-flex items-center bg-[#E07A5F] border-[3px] border-retro-border rounded-full shadow-[2px_2px_0px_0px_#1F2937] px-2 py-1 text-white dir-rtl">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1 hover:bg-black/10 rounded-full transition-colors active:scale-90"
          title="חודש קודם"
        >
          <ChevronRight size={18} className="stroke-[3]" />
        </button>

        <button
          type="button"
          onClick={openModal}
          className="px-3 py-0.5 text-sm font-black tracking-wide hover:underline focus:outline-none"
        >
          {HEBREW_MONTHS[month]} {year}
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-1 hover:bg-black/10 rounded-full transition-colors active:scale-90"
          title="חודש הבא"
        >
          <ChevronLeft size={18} className="stroke-[3]" />
        </button>
      </div>

      {/* Retro Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-retro-border/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-[4px] border-retro-border rounded-3xl p-5 shadow-[6px_6px_0px_0px_#1F2937] w-full max-w-xs space-y-4 dir-rtl text-right">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b-2 border-retro-border/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-retro-yellow border-2 border-retro-border rounded-xl">
                  <Calendar size={18} className="text-retro-border" />
                </div>
                <h3 className="font-black text-base text-retro-border">בחירת חודש לתצוגה</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg border-2 border-transparent hover:border-retro-border transition-all"
              >
                <X size={18} className="text-retro-border" />
              </button>
            </div>

            {/* Year Controls */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl border-2 border-retro-border">
              <button
                type="button"
                onClick={() => setTempYear((y) => y - 1)}
                className="p-1 bg-white border-2 border-retro-border rounded-lg shadow-retro-sm hover:bg-retro-yellow active:translate-y-0.5 font-black transition-all"
              >
                <ChevronRight size={18} className="text-retro-border" />
              </button>
              <span className="font-black text-base text-retro-border">{tempYear}</span>
              <button
                type="button"
                onClick={() => setTempYear((y) => y + 1)}
                className="p-1 bg-white border-2 border-retro-border rounded-lg shadow-retro-sm hover:bg-retro-yellow active:translate-y-0.5 font-black transition-all"
              >
                <ChevronLeft size={18} className="text-retro-border" />
              </button>
            </div>

            {/* 12 Months Grid */}
            <div className="grid grid-cols-3 gap-2">
              {HEBREW_MONTHS.map((name, idx) => {
                const isSelected = tempMonth === idx;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setTempMonth(idx)}
                    className={`py-2 px-1 text-xs font-black rounded-xl border-2 border-retro-border transition-all ${
                      isSelected
                        ? 'bg-retro-yellow text-retro-border shadow-[2px_2px_0px_0px_#1F2937] scale-105'
                        : 'bg-white text-retro-border/70 hover:bg-slate-50'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmModal}
                className="flex-1 py-2.5 bg-retro-green text-retro-border font-black text-sm border-2 border-retro-border rounded-xl shadow-[2px_2px_0px_0px_#1F2937] hover:scale-[1.02] active:scale-95 transition-all"
              >
                אישור
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="py-2.5 px-4 bg-slate-100 text-retro-border font-black text-sm border-2 border-retro-border rounded-xl hover:bg-slate-200 transition-all"
              >
                ביטול
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}