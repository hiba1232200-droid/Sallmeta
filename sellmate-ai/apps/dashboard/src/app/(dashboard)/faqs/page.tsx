'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea } from '@/lib/ui';

export default function FaqsPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '' });

  const load = useCallback(() => {
    request('/faqs?limit=100')
      .then((r: any) => setItems(r.items))
      .catch((e) => setError((e as Error).message));
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/faqs', { method: 'POST', body: JSON.stringify(form) });
      setForm({ question: '', answer: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('حذف هذا السؤال؟')) return;
    try {
      await request(`/faqs/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="الأسئلة الشائعة" subtitle="يستخدمها المساعد للإجابة عن أسئلة العملاء المتكررة" />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <Card className="mb-6">
        <form onSubmit={create} className="space-y-4">
          <Field label="السؤال">
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} required />
          </Field>
          <Field label="الإجابة">
            <Textarea
              rows={2}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              required
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? '...جارٍ' : 'إضافة'}
          </Button>
        </form>
      </Card>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد أسئلة بعد." />
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">{f.question}</p>
                  <p className="mt-1 text-sm text-slate-600">{f.answer}</p>
                </div>
                <button className="shrink-0 text-xs text-red-600 hover:underline" onClick={() => remove(f.id)}>
                  حذف
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
