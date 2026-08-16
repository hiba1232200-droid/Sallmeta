'use client';

import { useEffect } from 'react';
import { Badge, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, usePaged } from '@/lib/table';
import { formatDate, formatMoney } from '@/lib/format';

export default function PaymentsPage() {
  const { items, nextCursor, loading, error, load } = usePaged<any>(
    (c) => `/admin/payments?limit=30${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color = (s: string) =>
    s === 'PAID' ? 'green' : s === 'REFUNDED' ? 'amber' : s === 'FAILED' ? 'red' : 'slate';

  return (
    <div>
      <PageHeader title="المدفوعات" subtitle="سجلّ مدفوعات الاشتراكات عبر كل المتاجر" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا توجد مدفوعات بعد. (تُسجَّل عند اكتمال الدفع عبر Stripe.)"
        columns={[
          { key: 'createdAt', header: 'التاريخ', render: (p) => formatDate(p.createdAt) },
          { key: 'merchantName', header: 'المتجر', render: (p) => p.merchantName },
          {
            key: 'amount',
            header: 'المبلغ',
            render: (p) => <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>,
          },
          { key: 'planTier', header: 'الخطة', render: (p) => <Badge color="violet">{p.planTier ?? '—'}</Badge> },
          { key: 'provider', header: 'المزوّد', render: (p) => p.provider },
          { key: 'status', header: 'الحالة', render: (p) => <Badge color={color(p.status)}>{p.status}</Badge> },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
