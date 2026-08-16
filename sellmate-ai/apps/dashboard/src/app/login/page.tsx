'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, Input } from '@/lib/ui';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ storeName: '', name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            S
          </div>
          <h1 className="text-2xl font-bold text-slate-900">SellMate AI</h1>
          <p className="mt-1 text-sm text-slate-500">مساعد مبيعات ذكي على تيليجرام لإدارة متجرك</p>
        </div>

        <Card>
          <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              className={`flex-1 rounded-md py-2 ${mode === 'login' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
              onClick={() => setMode('login')}
              type="button"
            >
              تسجيل الدخول
            </button>
            <button
              className={`flex-1 rounded-md py-2 ${mode === 'register' ? 'bg-white font-medium shadow-sm' : 'text-slate-500'}`}
              onClick={() => setMode('register')}
              type="button"
            >
              متجر جديد
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Field label="اسم المتجر">
                  <Input
                    value={form.storeName}
                    onChange={(e) => update('storeName', e.target.value)}
                    placeholder="متجري"
                    required
                  />
                </Field>
                <Field label="اسمك">
                  <Input
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="الاسم الكامل"
                    required
                  />
                </Field>
              </>
            )}
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="٨ أحرف على الأقل"
                required
                minLength={8}
              />
            </Field>

            {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? '...جارٍ' : mode === 'login' ? 'دخول' : 'إنشاء المتجر'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
