'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, EmptyState, PageHeader, Spinner, StatCard } from '@/lib/ui';
import { formatMoney } from '@/lib/format';
import { CHART_COLORS, Chart, shortDate } from '@/lib/charts';

const RANGES = [
  { key: 'today', label: 'اليوم', days: 1 },
  { key: '7d', label: '٧ أيام', days: 7 },
  { key: '30d', label: '٣٠ يومًا', days: 30 },
  { key: 'all', label: 'كل الوقت', days: 90 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>
      {children}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { request } = useAuth();
  const [range, setRange] = useState<RangeKey>('30d');
  const [metrics, setMetrics] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    try {
      const [m, s] = await Promise.all([
        request(`/analytics/metrics?range=${range}`),
        request(`/analytics/series?days=${days}`).catch(() => ({ series: [] })),
      ]);
      setMetrics(m);
      setSeries(s.series ?? []);
    } catch (e) {
      setError((e as Error).message);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [request, range]);

  useEffect(() => {
    load();
  }, [load]);

  const salesData = series.map((p) => ({ label: shortDate(p.date), value: p.revenue }));
  const ordersData = series.map((p) => ({ label: shortDate(p.date), value: p.orders }));
  const customersData = series.map((p) => ({ label: shortDate(p.date), value: p.customers }));
  const aiData = series.map((p) => ({ label: shortDate(p.date), value: p.aiMessages }));

  return (
    <div>
      <PageHeader
        title="محرّك التحليلات"
        subtitle="كل المؤشّرات حسب النطاق الزمني الذي تختاره"
        action={
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-md px-3 py-1 ${
                  range === r.key ? 'bg-white font-medium shadow-sm' : 'text-slate-500'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{error}</p>
        </Card>
      )}

      {loading && !metrics ? (
        <Spinner />
      ) : metrics ? (
        <>
          {/* مؤشّرات النطاق المختار */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="الرسائل الواردة" value={metrics.messages.toLocaleString('en-US')} />
            <StatCard label="ردود الذكاء" value={metrics.aiResponses.toLocaleString('en-US')} />
            <StatCard label="المحادثات" value={metrics.conversations.toLocaleString('en-US')} />
            <StatCard label="العملاء النشطون" value={metrics.activeCustomers.toLocaleString('en-US')} />
            <StatCard
              label="معدّل التحويل"
              value={`${metrics.conversionRate}%`}
              hint="الطلبات المكتملة ÷ المحادثات"
            />
            <StatCard label="الطلبات" value={metrics.orders.toLocaleString('en-US')} />
            <StatCard label="الطلبات المكتملة" value={metrics.completedOrders.toLocaleString('en-US')} />
            <StatCard label="الطلبات الملغاة" value={metrics.cancelledOrders.toLocaleString('en-US')} />
            <StatCard label="الإيرادات" value={formatMoney(metrics.revenue)} />
            <StatCard label="متوسط قيمة الطلب" value={formatMoney(metrics.averageOrderValue)} />
          </div>

          {/* الرسوم البيانية (سلسلة زمنية) */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="المبيعات">
              <Chart data={salesData} type="area" color={CHART_COLORS.blue} height={200} format={(v) => formatMoney(v)} />
            </ChartCard>
            <ChartCard title="الطلبات">
              <Chart data={ordersData} type="bar" color={CHART_COLORS.aqua} height={200} />
            </ChartCard>
            <ChartCard title="العملاء الجدد">
              <Chart data={customersData} type="area" color={CHART_COLORS.violet} height={200} />
            </ChartCard>
            <ChartCard title="ردود المساعد">
              <Chart data={aiData} type="area" color={CHART_COLORS.orange} height={200} />
            </ChartCard>
          </div>

          {/* أفضل المنتجات */}
          <div className="mt-6">
            <Card className="overflow-x-auto p-0">
              <div className="border-b border-slate-100 p-4">
                <p className="font-bold text-slate-900">أفضل المنتجات مبيعًا</p>
              </div>
              {metrics.topProducts.length === 0 ? (
                <div className="p-4">
                  <EmptyState message="لا توجد مبيعات في هذا النطاق." />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="p-3 text-right font-medium">المنتج</th>
                      <th className="p-3 text-right font-medium">الكمية المباعة</th>
                      <th className="p-3 text-right font-medium">الإيراد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topProducts.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-slate-500">{p.quantity} قطعة</td>
                        <td className="p-3">{formatMoney(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
