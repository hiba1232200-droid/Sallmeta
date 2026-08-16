'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Input, PageHeader, Spinner, StatCard } from '@/lib/ui';
import { DataTable } from '@/lib/table';

export default function AiUsagePage() {
  const { request } = useAuth();
  const [period, setPeriod] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = (p?: string) => {
    setData(null);
    request(`/admin/ai-usage${p ? `?period=${p}` : ''}`)
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="استخدام الذكاء الاصطناعي" subtitle="عدد رسائل المساعد لكل متجر خلال الشهر" />

      <div className="mb-4 flex items-end gap-2">
        <div className="w-48">
          <label className="mb-1 block text-sm text-slate-600">الفترة (YYYY-MM)</label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-08" />
        </div>
        <button
          onClick={() => load(period || undefined)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          عرض
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard label="إجمالي الرسائل" value={data.total} hint={`الفترة ${data.period}`} />
            <StatCard label="عدد المتاجر النشطة" value={data.stores.length} />
          </div>
          <DataTable
            rows={data.stores.map((s: any, i: number) => ({ id: String(i), ...s }))}
            empty="لا يوجد استخدام في هذه الفترة."
            columns={[
              { key: 'merchantName', header: 'المتجر', render: (s) => <span className="font-medium">{s.merchantName}</span> },
              { key: 'count', header: 'رسائل الذكاء', render: (s) => s.count.toLocaleString('en-US') },
            ]}
          />
        </>
      )}
    </div>
  );
}
