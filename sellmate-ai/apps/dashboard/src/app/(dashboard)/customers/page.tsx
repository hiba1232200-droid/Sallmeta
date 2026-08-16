'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, EmptyState, Input, PageHeader, Spinner } from '@/lib/ui';
import { formatDate } from '@/lib/format';

export default function CustomersPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (search) params.set('search', search);
      const r = await request(`/customers?${params.toString()}`);
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const name = (c: any) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || 'عميل';

  return (
    <div>
      <PageHeader title="العملاء" subtitle="العملاء الذين تفاعلوا مع متجرك عبر تيليجرام" />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 max-w-sm">
        <Input placeholder="🔎 بحث بالاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا يوجد عملاء بعد." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">الاسم</th>
                <th className="p-3 text-right font-medium">المعرّف</th>
                <th className="p-3 text-right font-medium">الهاتف</th>
                <th className="p-3 text-right font-medium">الطلبات</th>
                <th className="p-3 text-right font-medium">آخر ظهور</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 last:border-0">
                  <td className="p-3 font-medium">{name(c)}</td>
                  <td className="p-3 text-slate-500">{c.username ? `@${c.username}` : '—'}</td>
                  <td className="p-3">{c.phone || '—'}</td>
                  <td className="p-3">{c._count?.orders ?? 0}</td>
                  <td className="p-3 text-slate-500">{formatDate(c.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
