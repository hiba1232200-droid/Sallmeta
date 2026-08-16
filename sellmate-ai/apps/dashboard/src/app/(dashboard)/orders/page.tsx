'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/lib/ui';
import {
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  formatDate,
  formatMoney,
} from '@/lib/format';

export default function OrdersPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (statusFilter) params.set('status', statusFilter);
      const r = await request(`/orders?${params.toString()}`);
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      const o = await request(`/orders/${id}`);
      setDetail(o);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      await request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
      if (detail?.id === id) {
        openDetail(id);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const customerLabel = (o: any) =>
    o.customerName ||
    [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') ||
    o.customer?.username ||
    'عميل';

  return (
    <div>
      <PageHeader title="الطلبات" subtitle="الطلبات الواردة من تيليجرام ولوحة التحكم" />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد طلبات مطابقة." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">رقم الطلب</th>
                <th className="p-3 text-right font-medium">العميل</th>
                <th className="p-3 text-right font-medium">العناصر</th>
                <th className="p-3 text-right font-medium">الإجمالي</th>
                <th className="p-3 text-right font-medium">الحالة</th>
                <th className="p-3 text-right font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="p-3">
                    <button className="font-medium text-brand-600 hover:underline" onClick={() => openDetail(o.id)}>
                      {o.number}
                    </button>
                  </td>
                  <td className="p-3">{customerLabel(o)}</td>
                  <td className="p-3">{o._count?.items ?? '-'}</td>
                  <td className="p-3">{formatMoney(o.total, o.currency)}</td>
                  <td className="p-3">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={o.status}
                      onChange={(e) => changeStatus(o.id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-slate-500">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* تفاصيل الطلب */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold">طلب #{detail.number}</h2>
                <Badge color={ORDER_STATUS_COLORS[detail.status] ?? 'slate'}>
                  {ORDER_STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
              </div>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>

            <table className="mb-4 w-full text-sm">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="p-2 text-right font-medium">المنتج</th>
                  <th className="p-2 text-right font-medium">السعر</th>
                  <th className="p-2 text-right font-medium">الكمية</th>
                  <th className="p-2 text-right font-medium">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items ?? []).map((it: any) => (
                  <tr key={it.id} className="border-b border-slate-50 last:border-0">
                    <td className="p-2">{it.productName}</td>
                    <td className="p-2">{formatMoney(it.unitPrice, detail.currency)}</td>
                    <td className="p-2">{it.quantity}</td>
                    <td className="p-2">{formatMoney(it.lineTotal, detail.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">المجموع الفرعي</span>
                <span>{formatMoney(detail.subtotal, detail.currency)}</span>
              </div>
              {Number(detail.discount) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>الخصم</span>
                  <span>-{formatMoney(detail.discount, detail.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1 font-bold">
                <span>الإجمالي</span>
                <span>{formatMoney(detail.total, detail.currency)}</span>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="mb-1 font-medium text-slate-700">بيانات العميل</p>
              <p>الاسم: {detail.customerName || customerLabel(detail)}</p>
              {detail.customerPhone && <p>الهاتف: {detail.customerPhone}</p>}
              {detail.customerAddress && <p>العنوان: {detail.customerAddress}</p>}
              {detail.notes && <p>ملاحظات: {detail.notes}</p>}
              <p className="mt-1 text-xs text-slate-400">
                المصدر: {detail.source} · {formatDate(detail.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">تغيير الحالة:</span>
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={detail.status}
                onChange={(e) => changeStatus(detail.id, e.target.value)}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
