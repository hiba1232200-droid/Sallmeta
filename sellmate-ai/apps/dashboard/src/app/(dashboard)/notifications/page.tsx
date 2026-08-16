'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, PageHeader, Spinner } from '@/lib/ui';
import { formatDate } from '@/lib/format';

const TYPE_ICON: Record<string, string> = {
  NEW_ORDER: '🛒',
  NEW_CUSTOMER: '👤',
  HUMAN_ASSISTANCE_REQUIRED: '🔔',
  LOW_STOCK: '⚠️',
  SUBSCRIPTION_EXPIRING: '⏳',
  USAGE_LIMIT_NEAR: '📊',
};

export default function NotificationsPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (reset: boolean, cur: string | null = null) => {
      setLoading(true);
      setError('');
      try {
        const q = `/notifications?limit=20${unreadOnly ? '&unreadOnly=true' : ''}${cur ? `&cursor=${cur}` : ''}`;
        const data = await request(q);
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor ?? null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [request, unreadOnly],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const markRead = async (n: any) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    await request(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => undefined);
  };

  const markAllRead = async () => {
    await request('/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="الإشعارات"
        subtitle="تنبيهات متجرك: الطلبات، العملاء، المخزون، والاشتراك"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                unreadOnly ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              غير المقروءة فقط
            </button>
            <Button variant="outline" onClick={markAllRead}>
              تعليم الكل كمقروء
            </Button>
          </div>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {loading && items.length === 0 ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد إشعارات بعد." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`flex cursor-pointer items-start gap-3 ${n.isRead ? '' : 'border-brand-200 bg-brand-50/40'}`}
            >
              <button className="flex flex-1 items-start gap-3 text-right" onClick={() => markRead(n)}>
                <span className="text-xl leading-none">{TYPE_ICON[n.type] ?? '🔔'}</span>
                <span className="flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{n.title}</span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">{n.body}</span>
                  <span className="mt-1 block text-xs text-slate-400">{formatDate(n.createdAt)}</span>
                </span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => load(false, cursor)} disabled={loading}>
            {loading ? '...جارٍ' : 'تحميل المزيد'}
          </Button>
        </div>
      )}
    </div>
  );
}
