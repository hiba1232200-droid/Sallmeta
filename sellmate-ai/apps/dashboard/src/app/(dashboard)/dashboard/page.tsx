'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Card, EmptyState, PageHeader, Spinner, StatCard } from '@/lib/ui';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, formatDate, formatMoney } from '@/lib/format';
import { CHART_COLORS, Chart, shortDate } from '@/lib/charts';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>
      {children}
    </Card>
  );
}

export default function DashboardPage() {
  const { request } = useAuth();
  const [data, setData] = useState<any>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // نظرة عامة متاحة لكل الخطط (لوحة أساسية)؛ السلاسل الزمنية ميزة تحليلات قد تكون مقفلة.
    Promise.all([
      request('/analytics/overview'),
      request('/analytics/series?days=30').catch(() => ({ series: [] })),
    ])
      .then(([overview, s]) => {
        setData(overview);
        setSeries(s.series ?? []);
      })
      .catch((e) => setError((e as Error).message));
  }, [request]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const salesData = series.map((p) => ({ label: shortDate(p.date), value: p.revenue }));
  const ordersData = series.map((p) => ({ label: shortDate(p.date), value: p.orders }));
  const customersData = series.map((p) => ({ label: shortDate(p.date), value: p.customers }));
  const aiData = series.map((p) => ({ label: shortDate(p.date), value: p.aiMessages }));

  return (
    <div>
      <PageHeader title="نظرة عامة" subtitle="ملخّص أداء متجرك خلال آخر ٣٠ يومًا" />

      {/* مؤشرات الأداء */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="إجمالي المبيعات" value={formatMoney(data.sales.total)} />
        <StatCard label="الطلبات" value={data.orders.total} />
        <StatCard label="العملاء" value={data.customers.total} />
        <StatCard label="المحادثات" value={data.conversations.total} />
        <StatCard label="معدّل التحويل" value={`${data.conversionRate}%`} hint="طلبات ÷ محادثات" />
        <StatCard label="رسائل المساعد (الشهر)" value={data.usage.aiMessages} />
        <StatCard label="المنتجات الفعّالة" value={data.products.active} />
        <StatCard label="طلبات قيد الانتظار" value={data.orders.pending} />
      </div>

      {/* الرسوم البيانية */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="المبيعات">
          <Chart data={salesData} type="area" color={CHART_COLORS.blue} format={(v) => formatMoney(v)} />
        </ChartCard>
        <ChartCard title="الطلبات">
          <Chart data={ordersData} type="bar" color={CHART_COLORS.aqua} />
        </ChartCard>
        <ChartCard title="العملاء الجدد">
          <Chart data={customersData} type="area" color={CHART_COLORS.violet} />
        </ChartCard>
        <ChartCard title="محادثات المساعد">
          <Chart data={aiData} type="area" color={CHART_COLORS.orange} />
        </ChartCard>
      </div>

      {/* أحدث الطلبات + أحدث المحادثات */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-100 p-4">
            <p className="font-bold text-slate-900">أحدث الطلبات</p>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState message="لا توجد طلبات بعد." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.recentOrders.map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium">{o.number}</td>
                    <td className="p-3 text-slate-500">{o.customerName || 'عميل'}</td>
                    <td className="p-3">
                      <Badge color={ORDER_STATUS_COLORS[o.status]}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </td>
                    <td className="p-3 text-left">{formatMoney(o.total, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-100 p-4">
            <p className="font-bold text-slate-900">أحدث المحادثات</p>
          </div>
          {data.recentConversations.length === 0 ? (
            <div className="p-4">
              <EmptyState message="لا توجد محادثات بعد." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {data.recentConversations.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-400">{formatDate(c.lastMessageAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === 'WAITING_FOR_HUMAN' && <Badge color="amber">بانتظار موظف</Badge>}
                    <span className="text-xs text-slate-400">{c.messages} رسالة</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* أفضل المنتجات */}
      <div className="mt-6">
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-slate-100 p-4">
            <p className="font-bold text-slate-900">أفضل المنتجات مبيعًا</p>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="p-4">
              <EmptyState message="لا توجد مبيعات بعد." />
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
                {data.topProducts.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.quantity}</td>
                    <td className="p-3">{formatMoney(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
