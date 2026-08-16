'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Spinner, cn } from '@/lib/ui';
import { CONVERSATION_STATUS_COLORS, CONVERSATION_STATUS_LABELS, formatDate } from '@/lib/format';

export default function ConversationsPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await request('/conversations?limit=50');
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id: string) => {
    try {
      const c = await request(`/conversations/${id}`);
      setSelected(c);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await request(`/conversations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      load();
      if (selected?.id === id) open(id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setBusy(true);
    try {
      await request('/telegram/reply', {
        method: 'POST',
        body: JSON.stringify({ conversationId: selected.id, message: reply }),
      });
      setReply('');
      open(selected.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const name = (c: any) =>
    [c.customer?.firstName, c.customer?.lastName].filter(Boolean).join(' ') ||
    c.customer?.username ||
    'عميل';

  return (
    <div>
      <PageHeader title="المحادثات" subtitle="تابع محادثات العملاء، وتولَّها عند الحاجة" />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* القائمة */}
        <div className="md:col-span-1">
          {!items ? (
            <Spinner />
          ) : items.length === 0 ? (
            <EmptyState message="لا توجد محادثات بعد." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <ul className="divide-y divide-slate-100">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => open(c.id)}
                      className={cn(
                        'w-full px-4 py-3 text-right hover:bg-slate-50',
                        selected?.id === c.id && 'bg-brand-50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-800">{name(c)}</span>
                        <Badge color={CONVERSATION_STATUS_COLORS[c.status] ?? 'slate'}>
                          {CONVERSATION_STATUS_LABELS[c.status] ?? c.status}
                        </Badge>
                      </div>
                      {c.customer?.username && (
                        <p className="text-xs text-slate-400">@{c.customer.username}</p>
                      )}
                      {c.messages?.[0] && (
                        <p className="mt-1 truncate text-xs text-slate-500">{c.messages[0].content}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xs text-slate-400">{formatDate(c.lastMessageAt)}</span>
                        {c.orders?.[0] && (
                          <span className="text-xs text-brand-600">طلب #{c.orders[0].number}</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* التفاصيل */}
        <div className="md:col-span-2">
          {!selected ? (
            <EmptyState message="اختر محادثة لعرضها وإدارتها." />
          ) : (
            <Card>
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{name(selected)}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge color={CONVERSATION_STATUS_COLORS[selected.status] ?? 'slate'}>
                      {CONVERSATION_STATUS_LABELS[selected.status] ?? selected.status}
                    </Badge>
                    {selected.orders?.[0] && (
                      <span className="text-xs text-brand-600">طلب #{selected.orders[0].number}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.status === 'HUMAN_ACTIVE' ? (
                    <Button variant="outline" onClick={() => setStatus(selected.id, 'AI_ACTIVE')}>
                      إعادة للمساعد
                    </Button>
                  ) : (
                    <Button onClick={() => setStatus(selected.id, 'HUMAN_ACTIVE')}>تولّي المحادثة</Button>
                  )}
                </div>
              </div>

              <div className="mb-4 max-h-96 space-y-3 overflow-y-auto">
                {selected.messages.map((m: any) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                      m.role === 'CUSTOMER'
                        ? 'mr-auto bg-slate-100 text-slate-800'
                        : m.role === 'AGENT'
                          ? 'ml-auto bg-slate-800 text-white'
                          : 'ml-auto bg-brand-600 text-white',
                    )}
                  >
                    {m.role === 'AGENT' && <p className="mb-0.5 text-[10px] opacity-70">موظف المتجر</p>}
                    {m.content}
                  </div>
                ))}
              </div>

              {selected.status === 'HUMAN_ACTIVE' ? (
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="اكتب ردّك للعميل..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendReply();
                    }}
                  />
                  <Button onClick={sendReply} disabled={busy || !reply.trim()}>
                    {busy ? '...' : 'إرسال'}
                  </Button>
                </div>
              ) : (
                <p className="border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
                  اضغط «تولّي المحادثة» لإيقاف المساعد والردّ على العميل بنفسك.
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
