'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Card, PageHeader, Spinner, StatCard } from '@/lib/ui';
import { formatDate, formatMoney } from '@/lib/format';

export default function OverviewPage() {
  const { request } = useAuth();
  const [data, setData] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([request('/admin/overview'), request('/admin/health').catch(() => null)])
      .then(([o, h]) => {
        setData(o);
        setHealth(h);
      })
      .catch((e) => setError((e as Error).message));
  }, [request]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const subs = data.subscriptions ?? {};
  const uptimeH = health ? Math.floor(health.uptimeSeconds / 3600) : 0;
  const uptimeM = health ? Math.floor((health.uptimeSeconds % 3600) / 60) : 0;

  return (
    <div>
      <PageHeader title="نظرة عامة على المنصّة" subtitle="ملخّص شامل لكل المتاجر والمستخدمين" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="المتاجر" value={data.stores.total} hint={`${data.stores.active} فعّال · ${data.stores.suspended} معلّق`} />
        <StatCard label="المستخدمون" value={data.users.total} hint={`${data.users.active} فعّال · ${data.users.suspended} معلّق`} />
        <StatCard label="إجمالي الطلبات" value={data.orders.total} />
        <StatCard label="رسائل الذكاء (الشهر)" value={data.aiMessagesThisMonth} hint={data.period} />
        <StatCard label="إيراد الاشتراكات" value={formatMoney(data.revenue.subscriptions)} />
        <StatCard label="حجم المبيعات" value={formatMoney(data.revenue.sales)} />
        <StatCard label="اشتراكات فعّالة" value={subs.ACTIVE ?? 0} />
        <StatCard label="فترات تجريبية" value={subs.TRIALING ?? 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-3 font-bold text-slate-900">صحّة النظام</p>
          {health ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الحالة</span>
                <Badge color={health.status === 'healthy' ? 'green' : 'red'}>
                  {health.status === 'healthy' ? 'سليم' : 'متدهور'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">قاعدة البيانات</span>
                <Badge color={health.db === 'up' ? 'green' : 'red'}>{health.db}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">مدة التشغيل</span>
                <span>{uptimeH}س {uptimeM}د</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">الذاكرة</span>
                <span>{health.memoryMb} MB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Node</span>
                <span className="text-slate-600">{health.nodeVersion}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">تعذّر جلب حالة النظام.</p>
          )}
        </Card>

        <Card>
          <p className="mb-3 font-bold text-slate-900">توزيع الاشتراكات</p>
          <div className="space-y-2 text-sm">
            {Object.keys(subs).length === 0 && <p className="text-slate-400">لا توجد اشتراكات.</p>}
            {Object.entries(subs).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-slate-600">{status}</span>
                <span className="font-medium">{count as number}</span>
              </div>
            ))}
          </div>
          {health && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-400">
              آخر تحديث: {formatDate(health.timestamp)}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
