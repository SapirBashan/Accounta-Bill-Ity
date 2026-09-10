'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MainPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-black text-retro-border">טוען נתונים...</div>;
  }

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
          <p className="text-2xl font-black text-retro-border">₪0</p>
        </div>

        {/* Expenses Card */}
        <div className="bg-retro-terracotta/20 border-[3px] border-retro-border rounded-2xl p-4 shadow-retro">
          <p className="text-xs font-black text-retro-border/70 mb-1">הוצאות</p>
          <p className="text-2xl font-black text-retro-border">₪0</p>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-retro-yellow border-[3px] border-retro-border rounded-2xl p-5 shadow-retro-lg flex justify-between items-center">
        <div>
          <p className="text-sm font-black text-retro-border/70">יתרה נוכחית</p>
          <p className="text-4xl font-black text-retro-border mt-1">₪0</p>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white border-[3px] border-retro-border rounded-2xl p-5 shadow-retro">
        <h2 className="text-lg font-black text-retro-border mb-3">פעילות אחרונה</h2>
        <div className="text-center py-8 text-sm font-bold text-retro-border/50 border-2 border-dashed border-retro-border/20 rounded-xl">
          אין נתונים להצגה עדיין
        </div>
      </div>

    </div>
  );
}