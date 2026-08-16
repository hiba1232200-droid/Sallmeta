'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, Toolbar, usePaged } from '@/lib/table';
import { formatDate } from '@/lib/format';

export default function StoresPage() {
  const { request } = useAuth();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { items, setItems, nextCursor, loading, error, load } = usePaged<any>(
    (c) =>
      `/admin/stores?limit=25${search ? `&search=${encodeURIComponent(search)}` : ''}${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (s: any) => {
    setBusy(s.id);
    try {
      const action = s.isActive ? 'suspend' : 'activate';
      await request(`/admin/stores/${s.id}/${action}`, { method: 'PATCH' });
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, isActive: !s.isActive } : x)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="المتاجر" subtitle="كل المتاجر المسجّلة على المنصّة" />
      <Toolbar search={search} onSearch={setSearch} onSubmit={() => load(true)} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا توجد متاجر."
        columns={[
          { key: 'name', header: 'المتجر', render: (s) => <span className="font-medium">{s.name}</span> },
          { key: 'owner', header: 'المالك', render: (s) => s.users?.[0]?.email ?? '—' },
          {
            key: 'plan',
            header: 'الخطة',
            render: (s) =>
              s.subscription ? (
                <Badge color="violet">{s.subscription.plan?.name ?? s.subscription.plan?.tier}</Badge>
              ) : (
                '—'
              ),
          },
          {
            key: 'counts',
            header: 'منتجات/طلبات',
            render: (s) => (
              <span className="text-slate-500">
                {s._count?.products ?? 0} / {s._count?.orders ?? 0}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'الحالة',
            render: (s) =>
              s.isActive ? <Badge color="green">فعّال</Badge> : <Badge color="red">معلّق</Badge>,
          },
          { key: 'createdAt', header: 'التسجيل', render: (s) => formatDate(s.createdAt) },
          {
            key: 'actions',
            header: '',
            render: (s) => (
              <Button
                variant={s.isActive ? 'outline' : 'primary'}
                onClick={() => toggle(s)}
                disabled={busy === s.id}
                className="!px-3 !py-1 text-xs"
              >
                {s.isActive ? 'تعليق المتجر' : 'تفعيل'}
              </Button>
            ),
          },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
