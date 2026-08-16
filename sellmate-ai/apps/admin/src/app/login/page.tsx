'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, Input } from '@/lib/ui';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-white">SellMate — لوحة المشرف</h1>
          <p className="mt-1 text-sm text-slate-400">دخول مقصور على مشرفي المنصّة</p>
        </div>

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? '...جارٍ' : 'دخول'}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-slate-500">
          يجب أن يكون بريدك ضمن PLATFORM_ADMIN_EMAILS على الخادم.
        </p>
      </div>
    </div>
  );
}
