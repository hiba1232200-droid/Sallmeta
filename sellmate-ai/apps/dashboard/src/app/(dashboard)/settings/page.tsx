'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Textarea } from '@/lib/ui';

const ROLE_LABELS: Record<string, string> = { OWNER: 'مالك', ADMIN: 'مدير', STAFF: 'موظف' };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-sm text-slate-500">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </Card>
  );
}

export default function SettingsPage() {
  const { request, user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [store, setStore] = useState<any>(null);
  const [tg, setTg] = useState<any>(null);
  const [botForm, setBotForm] = useState({ botToken: '', ownerChatId: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const canManageTeam = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const [s, t, u] = await Promise.all([
        request('/store'),
        request('/telegram/config').catch(() => null),
        request('/users').catch(() => []),
      ]);
      setStore(s);
      setTg(t);
      setUsers(u);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  const saveStore = async () => {
    try {
      await request('/store', {
        method: 'PATCH',
        body: JSON.stringify({
          name: store.name,
          phone: store.phone || undefined,
          email: store.email || undefined,
          description: store.description || undefined,
          currency: store.currency,
        }),
      });
      flash('تم حفظ بيانات المتجر');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const connectBot = async () => {
    try {
      const res = await request('/telegram/config', {
        method: 'PUT',
        body: JSON.stringify({ botToken: botForm.botToken, ownerChatId: botForm.ownerChatId || undefined }),
      });
      setBotForm({ botToken: '', ownerChatId: '' });
      flash(`تم ربط البوت @${res.botUsername}`);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleBot = async (activate: boolean) => {
    try {
      await request(`/telegram/${activate ? 'activate' : 'deactivate'}`, { method: 'POST' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/users', { method: 'POST', body: JSON.stringify(userForm) });
      setUserForm({ name: '', email: '', password: '', role: 'STAFF' });
      flash('تمت إضافة المستخدم');
      setUsers(await request('/users').catch(() => []));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deactivateUser = async (id: string) => {
    if (!confirm('تعطيل هذا المستخدم؟')) return;
    try {
      await request(`/users/${id}`, { method: 'DELETE' });
      setUsers(await request('/users').catch(() => []));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteStore = async () => {
    if (!confirm('حذف المتجر نهائيًا؟ سيُمحى كل شيء ولا يمكن التراجع.')) return;
    try {
      await request('/store', { method: 'DELETE' });
      logout();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="الإعدادات" subtitle="بيانات المتجر وربط بوت تيليجرام" />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      {store && (
        <Section title="بيانات المتجر">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="اسم المتجر">
              <Input value={store.name || ''} onChange={(e) => setStore({ ...store, name: e.target.value })} />
            </Field>
            <Field label="العملة">
              <Input value={store.currency || ''} onChange={(e) => setStore({ ...store, currency: e.target.value })} />
            </Field>
            <Field label="الهاتف">
              <Input value={store.phone || ''} onChange={(e) => setStore({ ...store, phone: e.target.value })} />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input value={store.email || ''} onChange={(e) => setStore({ ...store, email: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="وصف المتجر (يستخدمه المساعد)">
                <Textarea
                  rows={3}
                  value={store.description || ''}
                  onChange={(e) => setStore({ ...store, description: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={saveStore}>حفظ</Button>
          </div>
        </Section>
      )}

      <Section title="بوت تيليجرام" description="اربط بوت متجرك من BotFather ليبدأ باستقبال العملاء">
        {tg?.tokenSet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge color={tg.isActive ? 'green' : 'slate'}>{tg.isActive ? 'نشط' : 'متوقف'}</Badge>
              {tg.botUsername && <span className="text-sm text-slate-600">@{tg.botUsername}</span>}
            </div>
            <p className="break-all text-xs text-slate-400">Webhook: {tg.webhookUrl}</p>
            <div className="flex gap-2">
              {tg.isActive ? (
                <Button variant="outline" onClick={() => toggleBot(false)}>
                  إيقاف
                </Button>
              ) : (
                <Button onClick={() => toggleBot(true)}>تفعيل</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="رمز البوت (Bot Token)">
              <Input
                value={botForm.botToken}
                onChange={(e) => setBotForm({ ...botForm, botToken: e.target.value })}
                placeholder="123456789:ABC..."
              />
            </Field>
            <Field label="معرّف محادثة المالك للإشعارات (اختياري)">
              <Input
                value={botForm.ownerChatId}
                onChange={(e) => setBotForm({ ...botForm, ownerChatId: e.target.value })}
                placeholder="مثال: 987654321"
              />
            </Field>
            <Button onClick={connectBot} disabled={!botForm.botToken}>
              ربط البوت
            </Button>
          </div>
        )}
      </Section>

      {canManageTeam && (
        <Section title="الفريق" description="أضِف مستخدمين لمتجرك وامنحهم الأدوار المناسبة">
          <div className="mb-4 space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-sm"
              >
                <div>
                  <span className="font-medium">{u.name}</span>
                  <span className="mr-2 text-slate-400">{u.email}</span>
                  {!u.isActive && <span className="mr-2 text-red-500">(معطّل)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge color={u.role === 'OWNER' ? 'green' : u.role === 'ADMIN' ? 'blue' : 'slate'}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                  {u.role !== 'OWNER' && u.id !== user?.id && u.isActive && (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => deactivateUser(u.id)}>
                      تعطيل
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={addUser} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="الاسم">
              <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                required
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                required
                minLength={8}
              />
            </Field>
            <Field label="الدور">
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              >
                <option value="STAFF">موظف</option>
                <option value="ADMIN">مدير</option>
                {user?.role === 'OWNER' && <option value="OWNER">مالك</option>}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">إضافة مستخدم</Button>
            </div>
          </form>
        </Section>
      )}

      {user?.role === 'OWNER' && (
        <Section title="منطقة الخطر">
          <p className="mb-3 text-sm text-slate-500">
            حذف المتجر يمسح كل بياناته نهائيًا (المنتجات، الطلبات، العملاء، المحادثات...) ولا يمكن التراجع.
          </p>
          <Button variant="danger" onClick={deleteStore}>
            حذف المتجر
          </Button>
        </Section>
      )}
    </div>
  );
}
