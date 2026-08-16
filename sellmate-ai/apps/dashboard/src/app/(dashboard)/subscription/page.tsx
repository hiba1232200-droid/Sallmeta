'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, StatCard } from '@/lib/ui';
import { formatDate, formatMoney } from '@/lib/format';

/** أسماء الميزات بالعربية لعرضها تحت كل خطة. */
const FEATURE_LABELS: Record<string, string> = {
  basicDashboard: 'لوحة تحكم أساسية',
  orders: 'إدارة الطلبات',
  knowledgeBase: 'قاعدة المعرفة',
  analytics: 'تحليلات',
  advancedAnalytics: 'تحليلات متقدمة',
  multipleStaff: 'فريق متعدد',
  prioritySupport: 'دعم ذو أولوية',
  multipleStores: 'متاجر متعددة',
  apiAccess: 'وصول API',
  advancedAi: 'ذكاء اصطناعي متقدم',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعّال',
  TRIALING: 'فترة تجريبية',
  PAST_DUE: 'متأخر السداد',
  CANCELLED: 'ملغى',
  EXPIRED: 'منتهٍ',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  TRIALING: 'blue',
  PAST_DUE: 'amber',
  CANCELLED: 'red',
  EXPIRED: 'red',
};

function limitText(v: number, unit: string): string {
  return v < 0 ? `${unit} غير محدودة` : `${v} ${unit}`;
}

function featureList(features: Record<string, boolean> | undefined): string[] {
  if (!features) return [];
  return Object.entries(features)
    .filter(([, on]) => on === true)
    .map(([key]) => FEATURE_LABELS[key] ?? key);
}

export default function SubscriptionPage() {
  const { request } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p, u, me] = await Promise.all([
        request('/subscriptions/me'),
        request('/subscriptions/plans').catch(() => []),
        request('/subscriptions/usage').catch(() => null),
        request('/auth/me').catch(() => null),
      ]);
      setSub(s);
      setPlans(p);
      setUsage(u);
      setIsAdmin(Boolean(me?.user?.isPlatformAdmin));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const upgrade = async (tier: string) => {
    setError('');
    setMsg('');
    // نحاول أولًا عبر بوابة الدفع؛ فإن لم يُهيّأ مزوّد دفع نغيّر الخطة مباشرة.
    try {
      const res = await request('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
    } catch {
      // لا مزوّد دفع مُهيّأ — نكمل بالترقية اليدوية أدناه.
    }
    try {
      await request('/subscriptions/change', {
        method: 'POST',
        body: JSON.stringify({ tier }),
      });
      setMsg('تم تحديث خطتك.');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (p: any) => {
    setEditing(p.tier);
    setDraft({
      priceMonthly: Number(p.priceMonthly),
      monthlyMessageLimit: p.monthlyMessageLimit,
      productLimit: p.productLimit,
      staffLimit: p.staffLimit,
    });
    setMsg('');
    setError('');
  };

  const saveEdit = async (tier: string) => {
    setError('');
    try {
      await request(`/admin/plans/${tier}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priceMonthly: Number(draft.priceMonthly),
          monthlyMessageLimit: Number(draft.monthlyMessageLimit),
          productLimit: Number(draft.productLimit),
          staffLimit: Number(draft.staffLimit),
        }),
      });
      setEditing(null);
      setMsg(`تم حفظ خطة «${tier}».`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!sub) return <Spinner />;

  const expired = sub.active === false;

  return (
    <div className="max-w-5xl">
      <PageHeader title="الاشتراك" subtitle="خطتك الحالية والميزات وحدود الاستخدام" />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      {expired && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          انتهى اشتراكك المدفوع. بياناتك محفوظة بالكامل، لكن الميزات المدفوعة موقوفة مؤقتًا حتى تُجدِّد أو
          تُرقِّي خطتك.
        </div>
      )}

      {/* الخطة الحالية */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-slate-900">{sub.plan?.name}</p>
              <Badge color={STATUS_COLORS[sub.status] ?? 'slate'}>
                {STATUS_LABELS[sub.status] ?? sub.status}
              </Badge>
              {sub.active ? (
                <Badge color="green">نشِط</Badge>
              ) : (
                <Badge color="red">موقوف</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {limitText(sub.plan?.monthlyMessageLimit, 'رسالة/شهر')} ·{' '}
              {limitText(sub.plan?.productLimit, 'منتجات')} ·{' '}
              {limitText(sub.plan?.staffLimit, 'أعضاء فريق')}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {sub.trialEndsAt && sub.status === 'TRIALING'
                ? `تنتهي الفترة التجريبية في ${formatDate(sub.trialEndsAt)}`
                : sub.currentPeriodEnd
                  ? `${expired ? 'انتهى في' : 'يُجدَّد في'} ${formatDate(sub.currentPeriodEnd)}`
                  : ''}
            </p>
          </div>
          <p className="text-xl font-bold">
            {formatMoney(sub.plan?.priceMonthly ?? 0, sub.plan?.currency)}
            <span className="text-sm font-normal text-slate-400">/شهر</span>
          </p>
        </div>
        {featureList(sub.plan?.features).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {featureList(sub.plan?.features).map((f) => (
              <span key={f} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                ✓ {f}
              </span>
            ))}
          </div>
        )}
      </Card>

      {usage && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            label="رسائل المساعد (هذا الشهر)"
            value={usage.aiMessages}
            hint={`الفترة ${usage.period}`}
          />
          <StatCard label="الطلبات (هذا الشهر)" value={usage.ordersCreated} />
          <StatCard label="رسائل تيليجرام (هذا الشهر)" value={usage.telegramMessages} />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">الخطط المتاحة</h2>
        {isAdmin && (
          <Badge color="violet">وضع مشرف المنصّة — الأسعار قابلة للتعديل</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const current = sub.plan?.tier === p.tier;
          const isEditing = editing === p.tier;
          return (
            <Card key={p.tier} className="flex flex-col">
              <div className="text-center">
                <p className="font-bold text-slate-900">{p.name}</p>
                {isEditing ? (
                  <div className="my-2">
                    <Input
                      type="number"
                      value={draft.priceMonthly}
                      onChange={(e) => setDraft({ ...draft, priceMonthly: e.target.value })}
                    />
                  </div>
                ) : (
                  <p className="my-2 text-lg font-bold">
                    {formatMoney(p.priceMonthly, p.currency)}
                    <span className="text-xs font-normal text-slate-400">/شهر</span>
                  </p>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 text-sm">
                  <Field label="حد الرسائل/شهر (-1 غير محدود)">
                    <Input
                      type="number"
                      value={draft.monthlyMessageLimit}
                      onChange={(e) =>
                        setDraft({ ...draft, monthlyMessageLimit: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="حد المنتجات (-1 غير محدود)">
                    <Input
                      type="number"
                      value={draft.productLimit}
                      onChange={(e) => setDraft({ ...draft, productLimit: e.target.value })}
                    />
                  </Field>
                  <Field label="حد الفريق (-1 غير محدود)">
                    <Input
                      type="number"
                      value={draft.staffLimit}
                      onChange={(e) => setDraft({ ...draft, staffLimit: e.target.value })}
                    />
                  </Field>
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1" onClick={() => saveEdit(p.tier)}>
                      حفظ
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-2 text-center text-xs text-slate-500">
                    {limitText(p.monthlyMessageLimit, 'رسالة/شهر')}
                  </p>
                  <ul className="mb-3 flex-1 space-y-1 text-xs text-slate-600">
                    <li>• {limitText(p.productLimit, 'منتجات')}</li>
                    <li>• {limitText(p.staffLimit, 'أعضاء فريق')}</li>
                    {featureList(p.features).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                  {current ? (
                    <Badge color="green">خطتك الحالية</Badge>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => upgrade(p.tier)}>
                      {Number(p.priceMonthly) > Number(sub.plan?.priceMonthly ?? 0)
                        ? 'ترقية'
                        : 'اختيار'}
                    </Button>
                  )}
                  {isAdmin && (
                    <button
                      className="mt-2 text-xs text-violet-600 hover:underline"
                      onClick={() => startEdit(p)}
                    >
                      تعديل السعر والحدود
                    </button>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        يتطلب الدفع ضبط PAYMENT_PROVIDER (مثل Stripe) في إعدادات الخادم. تعديل الأسعار متاح لمشرفي
        المنصّة المحددين في PLATFORM_ADMIN_EMAILS.
      </p>
    </div>
  );
}
