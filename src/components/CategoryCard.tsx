'use client';

type CategoryCardProps = {
  name: string;
  groupName: string;
  spent?: number;
  budget?: number;
  plannedAmount?: number;
  onSelect?: () => void;
  onBudgetChange?: (value: string) => void;
  onBudgetBlur?: () => void;
};

export default function CategoryCard({
  name,
  groupName,
  spent = 0,
  budget = 0,
  plannedAmount,
  onSelect,
  onBudgetChange,
  onBudgetBlur,
}: CategoryCardProps) {
  const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const content = (
    <>
      <div className="flex justify-between items-start gap-2 mb-2">
        <span className="font-black text-sm text-retro-border line-clamp-1">{name}</span>
        <span className="shrink-0 text-[10px] font-bold bg-retro-bg px-2 py-0.5 border border-retro-border rounded-lg">
          {groupName}
        </span>
      </div>
      {onBudgetChange ? (
        <div className="flex items-center justify-end gap-2">
          <input
            type="number"
            value={plannedAmount ?? 0}
            onChange={(event) => onBudgetChange(event.target.value)}
            onBlur={onBudgetBlur}
            className="w-20 p-1.5 bg-white border-2 border-retro-border rounded-lg text-left font-black text-sm outline-none"
            dir="ltr"
          />
          <span className="text-xs font-black text-retro-border">₪</span>
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-xs font-black text-retro-border/80 mb-1" dir="ltr">
            <span>₪{spent}</span>
            <span className="text-retro-border/50">/ ₪{budget}</span>
          </div>
          <div className="w-full bg-retro-bg h-2 rounded-full border border-retro-border overflow-hidden">
            <div
              className={`h-full ${spent > budget && budget > 0 ? 'bg-retro-terracotta' : 'bg-retro-green'}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </>
  );

  if (!onSelect) return <div className="bg-retro-bg border-2 border-retro-border rounded-xl p-2">{content}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full border-2 border-retro-border rounded-2xl p-3 shadow-retro text-right bg-white hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
    >
      {content}
    </button>
  );
}