'use client';

import { useEffect } from 'react';
import { Badge, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, usePaged } from '@/lib/table';
import { formatDate } from '@/lib/format';

export default function ErrorsPage() {
  const { items, nextCursor, loading, error, load } = usePaged<any>(
    (c) => `/admin/errors?limit=40${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader title="أخطاء النظام" subtitle="أخطاء الخادم (5xx) المسجّلة للمراجعة" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا أخطاء مسجّلة. 🎉"
        columns={[
          { key: 'createdAt', header: 'الوقت', render: (e) => formatDate(e.createdAt) },
          { key: 'statusCode', header: 'الرمز', render: (e) => <Badge color="red">{e.statusCode}</Badge> },
          { key: 'method', header: 'الطريقة', render: (e) => <span className="text-slate-500">{e.method}</span> },
          {
            key: 'path',
            header: 'المسار',
            render: (e) => <span className="font-mono text-xs">{e.path}</span>,
          },
          {
            key: 'message',
            header: 'الرسالة',
            render: (e) => <span className="text-xs text-slate-600">{e.message ?? '—'}</span>,
          },
          {
            key: 'requestId',
            header: 'المعرّف',
            render: (e) => <span className="font-mono text-[10px] text-slate-400">{e.requestId ?? '—'}</span>,
          },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
