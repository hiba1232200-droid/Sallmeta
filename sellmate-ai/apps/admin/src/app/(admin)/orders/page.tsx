'use client';

import { useEffect, useState } from 'react';
import { Badge, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, Toolbar, usePaged } from '@/lib/table';
import { ORDER_STATUS_LABELS, formatDate, formatMoney } from '@/lib/format';

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];

export default function OrdersPage() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { items, nextCursor, loading, error, load } = usePaged<any>(
    (c) =>
      `/admin/orders?limit=30${status ? `&status=${status}` : ''}${
        search ? `&search=${encodeURIComponent(search)}` : ''
      }${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const color = (s: string) =>
    s === 'COMPLETED' ? 'green' : s === 'CANCELLED' ? 'red' : s === 'PENDING' ? 'amber' : 'blue';

  return (
    <div>
      <PageHeader title="الطلبات" subtitle="كل الطلبات عبر جميع المتاجر" />
      <Toolbar search={search} onSearch={setSearch} onSubmit={() => load(true)}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Toolbar>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا توجد طلبات."
        columns={[
          { key: 'number', header: 'رقم الطلب', render: (o) => <span className="font-medium">{o.number}</span> },
          { key: 'store', header: 'المتجر', render: (o) => o.merchant?.name ?? '—' },
          { key: 'customerName', header: 'العميل', render: (o) => o.customerName ?? '—' },
          { key: 'total', header: 'الإجمالي', render: (o) => formatMoney(o.total, o.currency) },
          { key: 'status', header: 'الحالة', render: (o) => <Badge color={color(o.status)}>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge> },
          { key: 'createdAt', header: 'التاريخ', render: (o) => formatDate(o.createdAt) },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
