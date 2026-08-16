'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Field, Input, PageHeader, Spinner } from '@/lib/ui';
import { formatMoney } from '@/lib/format';

export default function PlansPage() {
  const { request } = useAuth();
  const [plans, setPlans] = useState<any[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    request('/admin/plans')
      .then((p) => setPlans(p))
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftFor = (p: any) =>
    drafts[p.tier] ?? {
      priceMonthly: Number(p.priceMonthly),
      monthlyMessageLimit: p.monthlyMessageLimit,
      productLimit: p.productLimit,
      staffLimit: p.staffLimit,
    };

  const setDraft = (tier: string, patch: any) =>
    setDrafts((prev) => ({ ...prev, [tier]: { ...draftFor(plans!.find((p) => p.tier === tier)), ...patch } }));

  const save = async (p: any) => {
    const d = draftFor(p);
    setBusy(p.tier);
    setError('');
    setMsg('');
    try {
      await request(`/admin/plans/${p.tier}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priceMonthly: Number(d.priceMonthly),
          monthlyMessageLimit: Number(d.monthlyMessageLimit),
          productLimit: Number(d.productLimit),
          staffLimit: Number(d.staffLimit),
        }),
      });
      setMsg(`تم حفظ خطة ${p.tier}.`);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!plans) return <Spinner />;

  return (
    <div>
      <PageHeader title="الخطط والحدود" subtitle="تعديل أسعار وحدود الخطط على مستوى المنصّة" />
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const d = draftFor(p);
          return (
            <Card key={p.tier}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-bold text-slate-900">{p.name}</p>
                <Badge color="violet">{p.tier}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <Field label="السعر الشهري ($)">
                  <Input
                    type="number"
                    value={d.priceMonthly}
                    onChange={(e) => setDraft(p.tier, { priceMonthly: e.target.value })}
                  />
                </Field>
                <Field label="حد الرسائل/شهر (-1 غير محدود)">
                  <Input
                    type="number"
                    value={d.monthlyMessageLimit}
                    onChange={(e) => setDraft(p.tier, { monthlyMessageLimit: e.target.value })}
                  />
                </Field>
                <Field label="حد المنتجات (-1 غير محدود)">
                  <Input
                    type="number"
                    value={d.productLimit}
                    onChange={(e) => setDraft(p.tier, { productLimit: e.target.value })}
                  />
                </Field>
                <Field label="حد الفريق (-1 غير محدود)">
                  <Input
                    type="number"
                    value={d.staffLimit}
                    onChange={(e) => setDraft(p.tier, { staffLimit: e.target.value })}
                  />
                </Field>
              </div>
              <p className="mt-2 text-xs text-slate-400">الحالي: {formatMoney(p.priceMonthly, p.currency)}</p>
              <Button
                className="mt-3 w-full"
                onClick={() => save(p)}
                disabled={busy === p.tier}
              >
                {busy === p.tier ? '...جارٍ' : 'حفظ'}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
