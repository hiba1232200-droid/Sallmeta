'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner, cn } from '@/lib/ui';

const NAV = [
  { href: '/overview', label: 'نظرة عامة', icon: '📊' },
  { href: '/users', label: 'المستخدمون', icon: '👤' },
  { href: '/stores', label: 'المتاجر', icon: '🏬' },
  { href: '/subscriptions', label: 'الاشتراكات', icon: '📄' },
  { href: '/plans', label: 'الخطط والحدود', icon: '🎚️' },
  { href: '/payments', label: 'المدفوعات', icon: '💰' },
  { href: '/orders', label: 'الطلبات', icon: '📦' },
  { href: '/ai-usage', label: 'استخدام الذكاء', icon: '🤖' },
  { href: '/reports', label: 'التقارير', icon: '📈' },
  { href: '/logs', label: 'سجلّ النظام', icon: '📜' },
  { href: '/errors', label: 'الأخطاء', icon: '⚠️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && (!user || !user.isPlatformAdmin)) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* شريط علوي للجوال */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-slate-200 md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">⚡</div>
          <span className="font-bold text-white">SellMate — المشرف</span>
        </div>
        <button
          aria-label="القائمة"
          onClick={() => setMenuOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-700 text-slate-200"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={cn(
          'w-60 shrink-0 flex-col bg-slate-900 p-4 text-slate-200',
          'md:static md:flex',
          menuOpen ? 'fixed inset-y-0 right-0 z-50 flex' : 'hidden',
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
              ⚡
            </div>
            <div>
              <span className="block font-bold text-white">SellMate</span>
              <span className="block text-xs text-slate-400">لوحة المشرف</span>
            </div>
          </div>
          <button aria-label="إغلاق" onClick={() => setMenuOpen(false)} className="text-slate-400 md:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                pathname === n.href
                  ? 'bg-brand-600 font-medium text-white'
                  : 'text-slate-300 hover:bg-slate-800',
              )}
            >
              <span className="text-base leading-none">{n.icon}</span>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-700 pt-4">
          <p className="px-2 text-xs text-slate-400">{user.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-right text-sm text-red-400 hover:bg-slate-800"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-100 p-4 pt-[4.5rem] md:p-6 md:pt-6">{children}</main>
    </div>
  );
}
