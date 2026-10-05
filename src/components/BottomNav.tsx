'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus, History, PieChart, WalletCards } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'ראשי', icon: LayoutGrid },
    { href: '/add', label: 'הוסף', icon: Plus },
    { href: '/history', label: 'היסטוריה', icon: History },
    { href: '/budget', label: 'תקציב', icon: PieChart },
    { href: '/income', label: 'הכנסות', icon: WalletCards },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-retro-bg border-t-2 border-retro-border py-2 px-4">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-4 rounded-2xl transition-all ${
                isActive
                  ? 'bg-retro-green border-2 border-retro-border shadow-retro font-bold text-retro-border'
                  : 'text-retro-border/70 hover:text-retro-border'
              }`}
            >
              <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-2'} />
              <span className="text-xs font-bold mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}