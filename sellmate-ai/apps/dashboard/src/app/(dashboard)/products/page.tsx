'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
} from '@/lib/ui';
import {
  PRODUCT_STATUSES,
  PRODUCT_STATUS_COLORS,
  PRODUCT_STATUS_LABELS,
  formatMoney,
} from '@/lib/format';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const EMPTY_FORM = {
  name: '',
  description: '',
  category: '',
  price: '',
  oldPrice: '',
  currency: '',
  stock: '',
  sku: '',
  status: 'ACTIVE',
  imageUrl: '',
  tags: '',
};

export default function ProductsPage() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (category) params.set('category', category);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const [list, cats] = await Promise.all([
        request(`/products?${params.toString()}`),
        request('/products/categories').catch(() => []),
      ]);
      setItems(list.items);
      setCategories(cats);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [request, search, status, category, sortBy, sortOrder]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setForm({
      name: p.name ?? '',
      description: p.description ?? '',
      category: p.category ?? '',
      price: String(p.price ?? ''),
      oldPrice: p.oldPrice != null ? String(p.oldPrice) : '',
      currency: p.currency ?? '',
      stock: String(p.stock ?? ''),
      sku: p.sku ?? '',
      status: p.status ?? 'ACTIVE',
      imageUrl: p.imageUrl ?? '',
      tags: Array.isArray(p.tags) ? p.tags.join('، ') : '',
    });
    setEditingId(p.id);
    setFormOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        category: form.category || undefined,
        price: Number(form.price),
        oldPrice: form.oldPrice ? Number(form.oldPrice) : undefined,
        currency: form.currency || undefined,
        stock: form.stock !== '' ? Number(form.stock) : undefined,
        sku: form.sku || undefined,
        status: form.status || undefined,
        imageUrl: form.imageUrl || undefined,
        tags: form.tags
          ? form.tags
              .split(/[,،]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
      };
      if (editingId) {
        await request(`/products/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await request('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('sm_access');
      const res = await fetch(`${API}/api/v1/products/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'فشل رفع الصورة' }));
        throw new Error(err.message || 'فشل رفع الصورة');
      }
      const data = await res.json();
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const adjust = async (id: string, delta: number) => {
    try {
      await request('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ productId: id, quantity: delta, type: 'ADJUSTMENT' }),
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const archive = async (id: string) => {
    if (!confirm('أرشفة هذا المنتج؟')) return;
    try {
      await request(`/products/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="المنتجات"
        subtitle="أضِف وأدِر منتجاتك — يستخدمها المساعد كمصدر معرفة"
        action={<Button onClick={openNew}>+ منتج جديد</Button>}
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {/* أدوات البحث والفلترة والترتيب */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <Input
            placeholder="🔎 بحث بالاسم أو الوصف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">كل الحالات</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">كل التصنيفات</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">الأحدث</option>
            <option value="price">السعر</option>
            <option value="name">الاسم</option>
            <option value="stock">المخزون</option>
          </select>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">تنازلي</option>
            <option value="asc">تصاعدي</option>
          </select>
        </div>
      </Card>

      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد منتجات مطابقة. أضِف منتجًا أو غيّر الفلاتر." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="p-3 text-right font-medium">المنتج</th>
                <th className="p-3 text-right font-medium">التصنيف</th>
                <th className="p-3 text-right font-medium">السعر</th>
                <th className="p-3 text-right font-medium">المخزون</th>
                <th className="p-3 text-right font-medium">الحالة</th>
                <th className="p-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-400">
                          📦
                        </div>
                      )}
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-500">{p.category || '—'}</td>
                  <td className="p-3">
                    <span className="font-medium">{formatMoney(p.price, p.currency || 'USD')}</span>
                    {p.oldPrice && (
                      <span className="mr-2 text-xs text-slate-400 line-through">{p.oldPrice}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="grid h-6 w-6 place-items-center rounded bg-slate-100 hover:bg-slate-200"
                        onClick={() => adjust(p.id, -1)}
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{p.stock}</span>
                      <button
                        className="grid h-6 w-6 place-items-center rounded bg-slate-100 hover:bg-slate-200"
                        onClick={() => adjust(p.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge color={PRODUCT_STATUS_COLORS[p.status] ?? 'slate'}>
                      {PRODUCT_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-left">
                    <button
                      className="ml-3 text-xs text-brand-600 hover:underline"
                      onClick={() => openEdit(p)}
                    >
                      تعديل
                    </button>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => archive(p.id)}
                    >
                      أرشفة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* نافذة الإضافة/التعديل */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? 'تعديل منتج' : 'منتج جديد'}</h2>
              <button className="text-slate-400 hover:text-slate-600" onClick={() => setFormOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="اسم المنتج">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="التصنيف">
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="مثال: ملابس"
                  list="cat-list"
                />
                <datalist id="cat-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="السعر">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </Field>
              <Field label="السعر القديم (اختياري)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                />
              </Field>
              <Field label="العملة (اختياري)">
                <Input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  placeholder="USD"
                />
              </Field>
              <Field label="المخزون">
                <Input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </Field>
              <Field label="SKU (اختياري)">
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </Field>
              <Field label="الحالة">
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {PRODUCT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PRODUCT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="الوصف">
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="الوسوم (مفصولة بفواصل)">
                  <Input
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="ملابس، صيف، قطن"
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">صورة المنتج</span>
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-400">
                      📷
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage(f);
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? '...جارٍ الرفع' : 'رفع صورة'}
                  </Button>
                  {form.imageUrl && (
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setForm({ ...form, imageUrl: '' })}
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex gap-2 md:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? '...جارٍ الحفظ' : 'حفظ'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
