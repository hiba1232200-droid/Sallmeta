'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, Toolbar, usePaged } from '@/lib/table';
import { ROLE_LABELS, formatDate } from '@/lib/format';

export default function UsersPage() {
  const { request } = useAuth();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { items, setItems, nextCursor, loading, error, load } = usePaged<any>(
    (c) =>
      `/admin/users?limit=25${search ? `&search=${encodeURIComponent(search)}` : ''}${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (u: any) => {
    setBusy(u.id);
    try {
      const action = u.isActive ? 'suspend' : 'activate';
      await request(`/admin/users/${u.id}/${action}`, { method: 'PATCH' });
      setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="المستخدمون" subtitle="كل مستخدمي المنصّة عبر جميع المتاجر" />
      <Toolbar search={search} onSearch={setSearch} onSubmit={() => load(true)} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا يوجد مستخدمون."
        columns={[
          { key: 'name', header: 'الاسم', render: (u) => <span className="font-medium">{u.name}</span> },
          { key: 'email', header: 'البريد', render: (u) => <span className="text-slate-500">{u.email}</span> },
          { key: 'role', header: 'الدور', render: (u) => <Badge color="blue">{ROLE_LABELS[u.role] ?? u.role}</Badge> },
          { key: 'store', header: 'المتجر', render: (u) => u.merchant?.name ?? '—' },
          {
            key: 'status',
            header: 'الحالة',
            render: (u) =>
              u.isActive ? <Badge color="green">فعّال</Badge> : <Badge color="red">معلّق</Badge>,
          },
          { key: 'lastLoginAt', header: 'آخر دخول', render: (u) => formatDate(u.lastLoginAt) },
          {
            key: 'actions',
            header: '',
            render: (u) => (
              <Button
                variant={u.isActive ? 'outline' : 'primary'}
                onClick={() => toggle(u)}
                disabled={busy === u.id}
                className="!px-3 !py-1 text-xs"
              >
                {u.isActive ? 'تعليق' : 'تفعيل'}
              </Button>
            ),
          },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
