'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, PageHeader } from '@/lib/ui';
import { DataTable, LoadMore, Toolbar, usePaged } from '@/lib/table';
import {
  PLAN_TIERS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUS_COLORS,
  SUBSCRIPTION_STATUS_LABELS,
  formatDate,
  formatMoney,
} from '@/lib/format';

export default function SubscriptionsPage() {
  const { request } = useAuth();
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { tier: string; status: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { items, setItems, nextCursor, loading, error, load } = usePaged<any>(
    (c) => `/admin/subscriptions?limit=25${status ? `&status=${status}` : ''}${c ? `&cursor=${c}` : ''}`,
  );

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const draftFor = (row: any) =>
    drafts[row.merchant.id] ?? { tier: row.plan?.tier ?? '', status: row.status };

  const setDraft = (id: string, patch: Partial<{ tier: string; status: string }>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(itemById(id)), ...patch } }));

  const itemById = (id: string) => items.find((i) => i.merchant.id === id);

  const save = async (row: any) => {
    const d = draftFor(row);
    setBusy(row.merchant.id);
    try {
      const updated = await request(`/admin/subscriptions/${row.merchant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tier: d.tier, status: d.status }),
      });
      setItems((prev) =>
        prev.map((x) =>
          x.merchant.id === row.merchant.id
            ? { ...x, status: updated.status, plan: { ...x.plan, tier: updated.plan?.tier, name: updated.plan?.name } }
            : x,
        ),
      );
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="الاشتراكات" subtitle="عرض وتغيير خطط وحالات اشتراك المتاجر" />
      <Toolbar>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {SUBSCRIPTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SUBSCRIPTION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </Toolbar>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <DataTable
        loading={loading}
        rows={items}
        empty="لا توجد اشتراكات."
        columns={[
          { key: 'store', header: 'المتجر', render: (r) => <span className="font-medium">{r.merchant?.name}</span> },
          {
            key: 'status',
            header: 'الحالة',
            render: (r) => (
              <Badge color={SUBSCRIPTION_STATUS_COLORS[r.status] ?? 'slate'}>
                {SUBSCRIPTION_STATUS_LABELS[r.status] ?? r.status}
              </Badge>
            ),
          },
          {
            key: 'price',
            header: 'السعر',
            render: (r) => formatMoney(r.plan?.priceMonthly ?? 0),
          },
          { key: 'end', header: 'ينتهي', render: (r) => formatDate(r.currentPeriodEnd) },
          {
            key: 'edit',
            header: 'تغيير',
            render: (r) => {
              const d = draftFor(r);
              return (
                <div className="flex items-center gap-2">
                  <select
                    value={d.tier}
                    onChange={(e) => setDraft(r.merchant.id, { tier: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    {PLAN_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={d.status}
                    onChange={(e) => setDraft(r.merchant.id, { status: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    {SUBSCRIPTION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {SUBSCRIPTION_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => save(r)}
                    disabled={busy === r.merchant.id}
                    className="!px-3 !py-1 text-xs"
                  >
                    حفظ
                  </Button>
                </div>
              );
            },
          },
        ]}
      />
      <LoadMore cursor={nextCursor} loading={loading} onMore={() => load(false, nextCursor)} />
    </div>
  );
}
