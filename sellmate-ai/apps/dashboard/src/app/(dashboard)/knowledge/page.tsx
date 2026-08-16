'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, Textarea } from '@/lib/ui';

const KB_CATEGORIES: Record<string, string> = {
  STORE_INFO: 'معلومات المتجر',
  SHIPPING: 'سياسة الشحن',
  EXCHANGE: 'سياسة الاستبدال',
  RETURN: 'سياسة الاسترجاع',
  PAYMENT: 'طرق الدفع',
  WORKING_HOURS: 'أوقات العمل',
  CONTACT: 'معلومات التواصل',
  TERMS: 'شروط البيع',
  FAQ: 'سؤال شائع',
  OTHER: 'أخرى',
};
const CATEGORY_KEYS = Object.keys(KB_CATEGORIES);

const EMPTY = { category: 'STORE_INFO', title: '', content: '' };

export default function KnowledgePage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (filter) params.set('category', filter);
      const r = await request(`/knowledge?${params.toString()}`);
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { category: form.category, title: form.title, content: form.content };
      if (editingId) {
        await request(`/knowledge/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      }
      resetForm();
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (entry: any) => {
    setForm({ category: entry.category, title: entry.title, content: entry.content });
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!confirm('حذف هذا العنصر؟')) return;
    try {
      await request(`/knowledge/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="قاعدة المعرفة"
        subtitle="سياسات ومعلومات متجرك — يستخدمها المساعد عبر الاسترجاع (RAG) للإجابة بدقّة"
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <Card className="mb-6">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="التصنيف">
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORY_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {KB_CATEGORIES[k]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="العنوان">
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </Field>
            </div>
          </div>
          <Field label="المحتوى">
            <Textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="مثال: نشحن خلال ٢-٤ أيام عمل لجميع المدن، والشحن مجاني للطلبات فوق ١٠٠."
              required
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? '...جارٍ الحفظ' : editingId ? 'حفظ التعديل' : 'إضافة'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                إلغاء التعديل
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="mb-4">
        <select
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">كل التصنيفات</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>
              {KB_CATEGORIES[k]}
            </option>
          ))}
        </select>
      </div>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد عناصر بعد. أضِف سياسات ومعلومات متجرك ليستخدمها المساعد." />
      ) : (
        <div className="space-y-3">
          {items.map((k) => (
            <Card key={k.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge color="blue">{KB_CATEGORIES[k.category] ?? k.category}</Badge>
                    <span className="font-medium text-slate-900">{k.title}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">{k.content}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-xs">
                  <button className="text-brand-600 hover:underline" onClick={() => edit(k)}>
                    تعديل
                  </button>
                  <button className="text-red-600 hover:underline" onClick={() => remove(k.id)}>
                    حذف
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
