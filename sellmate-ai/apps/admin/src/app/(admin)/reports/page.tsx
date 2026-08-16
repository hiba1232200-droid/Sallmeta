'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { PageHeader, Spinner, StatCard } from '@/lib/ui';
import { DataTable } from '@/lib/table';
import { formatMoney } from '@/lib/format';

export default function ReportsPage() {
  const { request } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/admin/reports')
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message));
  }, [request]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="التقارير" subtitle="ملخّصات مالية ونموّ المنصّة" />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="متاجر جديدة (30 يومًا)" value={data.last30Days.newStores} />
        <StatCard label="مستخدمون جدد (30 يومًا)" value={data.last30Days.newUsers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-bold text-slate-900">الإيراد حسب الخطة</h2>
          <DataTable
            rows={data.revenueByTier.map((r: any, i: number) => ({ id: String(i), ...r }))}
            empty="لا مدفوعات."
            columns={[
              { key: 'tier', header: 'الخطة' },
              { key: 'count', header: 'عدد المدفوعات' },
              { key: 'total', header: 'الإجمالي', render: (r) => formatMoney(r.total) },
            ]}
          />
        </div>

        <div>
          <h2 className="mb-2 font-bold text-slate-900">الاشتراكات حسب الحالة</h2>
          <DataTable
            rows={data.subscriptionsByStatus.map((r: any, i: number) => ({ id: String(i), ...r }))}
            empty="لا اشتراكات."
            columns={[
              { key: 'status', header: 'الحالة' },
              { key: 'count', header: 'العدد' },
            ]}
          />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-2 font-bold text-slate-900">أعلى المتاجر (بعدد الطلبات)</h2>
        <DataTable
          rows={data.topStores.map((r: any, i: number) => ({ id: String(i), ...r }))}
          empty="لا طلبات."
          columns={[
            { key: 'merchantName', header: 'المتجر', render: (r) => <span className="font-medium">{r.merchantName}</span> },
            { key: 'orders', header: 'الطلبات' },
            { key: 'sales', header: 'المبيعات', render: (r) => formatMoney(r.sales) },
          ]}
        />
      </div>
    </div>
  );
}
