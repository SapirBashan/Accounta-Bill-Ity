import { getRecentTransactions, TransactionItem } from '@/actions/transactions';
import { ShoppingBag, ArrowUpRight } from 'lucide-react';

type HistoryPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const selectedMonth = /^\d{4}-\d{2}$/.test(params.month || '')
    ? params.month
    : new Date().toISOString().slice(0, 7);
  const transactions: TransactionItem[] = await getRecentTransactions(50, selectedMonth);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-retro-border tracking-tight">היסטוריית תנועות 📜</h1>
        <p className="text-retro-border/80 font-medium mt-1">פירוט ההוצאות וההכנסות שלכם</p>
      </div>

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="bg-retro-card border-2 border-retro-border rounded-2xl p-8 shadow-retro text-center">
            <p className="font-bold text-retro-border/70">אין תנועות עדיין.</p>
          </div>
        ) : (
          transactions.map((tx) => {
            const isIncome = tx.category?.type === 'income';
            
            return (
              <div 
                key={tx.id} 
                className="bg-white border-2 border-retro-border rounded-2xl p-4 shadow-[2px_2px_0px_0px_#1F2937] flex justify-between items-center transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#1F2937]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 border-2 border-retro-border rounded-xl flex items-center justify-center ${isIncome ? 'bg-retro-yellow' : 'bg-retro-green-light'}`}>
                    {isIncome ? (
                      <ArrowUpRight size={24} className="text-retro-border" />
                    ) : (
                      <ShoppingBag size={20} className="text-retro-border" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-base text-retro-border">{tx.notes || 'ללא תיאור'}</h4>
                    <p className="text-xs font-bold text-retro-border/60 mt-0.5">
                      {new Date(tx.date).toLocaleDateString('he-IL')} • {tx.user_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span 
                    className={`font-black text-lg block ${isIncome ? 'text-retro-green' : 'text-retro-terracotta'}`} 
                    dir="ltr"
                  >
                    {isIncome ? '+' : '-'}₪{tx.amount}
                  </span>
                  <span className="text-[10px] font-bold text-retro-border/50 bg-retro-bg px-2 py-0.5 rounded-md border border-retro-border/20">
                    {tx.category?.name || 'כללי'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}