'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner, cn } from '@/lib/ui';

const NAV = [
  { href: '/dashboard', label: 'الرئيسية', icon: '📊' },
  { href: '/products', label: 'المنتجات', icon: '🛍️' },
  { href: '/orders', label: 'الطلبات', icon: '📦' },
  { href: '/customers', label: 'العملاء', icon: '👥' },
  { href: '/conversations', label: 'المحادثات', icon: '💬' },
  { href: '/notifications', label: 'الإشعارات', icon: '🔔' },
  { href: '/knowledge', label: 'قاعدة المعرفة', icon: '📚' },
  { href: '/ai-settings', label: 'إعدادات الذكاء', icon: '🤖' },
  { href: '/analytics', label: 'التحليلات', icon: '📈' },
  { href: '/subscription', label: 'الاشتراك', icon: '💳' },
  { href: '/settings', label: 'الإعدادات', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, request } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // يُغلق القائمة الجانبية عند التنقّل (على الجوال).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const refreshUnread = useCallback(() => {
    request('/notifications/unread-count')
      .then((r) => setUnread(r.count ?? 0))
      .catch(() => undefined);
  }, [request]);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [user, refreshUnread]);

  // يُصفّر العدّاد عند فتح صفحة الإشعارات.
  useEffect(() => {
    if (pathname === '/notifications') {
      const t = setTimeout(refreshUnread, 1500);
      return () => clearTimeout(t);
    }
  }, [pathname, refreshUnread]);

  useEffect(() => {
    if (!loading && !user) {
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
      {/* شريط علوي للجوال فيه زر القائمة */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">S</div>
          <span className="font-bold text-slate-900">SellMate AI</span>
        </div>
        <button
          aria-label="القائمة"
          onClick={() => setMenuOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>

      {/* خلفية معتّمة عند فتح القائمة على الجوال */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={cn(
          'w-60 shrink-0 flex-col border-l border-slate-200 bg-white p-4',
          'md:static md:flex', // ثابت داخل التدفّق على الشاشات المتوسطة فأكبر
          menuOpen ? 'fixed inset-y-0 right-0 z-50 flex' : 'hidden', // درج على الجوال
        )}
      >
        <div className="mb-6 flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">
              S
            </div>
            <span className="font-bold text-slate-900">SellMate AI</span>
          </div>
          <button
            aria-label="إغلاق"
            onClick={() => setMenuOpen(false)}
            className="text-slate-400 md:hidden"
          >
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
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <span className="text-base leading-none">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.href === '/notifications' && unread > 0 && (
                <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <p className="px-2 text-xs text-slate-400">
            {user.name} · {user.role === 'OWNER' ? 'مالك' : user.role === 'ADMIN' ? 'مدير' : 'موظف'}
          </p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-right text-sm text-red-600 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-[4.5rem] md:p-6 md:pt-6">{children}</main>
    </div>
  );
}
