import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import HeaderMenu from '@/components/HeaderMenu';
import MonthSelector from '@/components/MonthSelector';
import ThemeInitializer from '@/components/ThemeInitializer';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const heebo = Heebo({ subsets: ['hebrew', 'latin'] });

export const metadata: Metadata = {
  title: 'Accounta-Bill',
  description: 'ניהול תקציב משפחתי',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Accounta-Bill',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.className} bg-retro-bg text-retro-border min-h-screen pb-24 antialiased selection:bg-retro-yellow`}>
        <ThemeInitializer />
        <ServiceWorkerRegistration />
        
        {/* Fixed Retro Header */}
        <header className="bg-retro-green border-b-[3px] border-retro-border rounded-b-3xl px-4 py-4 mb-6 shadow-[0px_4px_0px_0px_#1F2937] relative">
          <div className="max-w-md mx-auto flex justify-between items-center relative">
            
            {/* Right Side (Menu Button) */}
            <div className="z-10 relative">
              <HeaderMenu />
            </div>

            {/* Absolute Center (Title) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-black text-xl text-retro-border tracking-tight mt-0.5 pointer-events-auto">
                
              </span>
            </div>

            {/* Left Side (Interactive Month Selector) */}
            <div className="z-10 relative">
              <Suspense fallback={
                <div className="bg-retro-terracotta text-white font-black text-xs px-3 py-1.5 rounded-xl border-2 border-retro-border">
                  טוען...
                </div>
              }>
                <MonthSelector />
              </Suspense>
            </div>
            
          </div>
        </header>

        <main className="max-w-md mx-auto px-4">{children}</main>
        
        <BottomNav />
      </body>
    </html>
  );
}