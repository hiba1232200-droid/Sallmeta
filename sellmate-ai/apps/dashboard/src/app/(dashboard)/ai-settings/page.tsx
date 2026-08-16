'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, Input, PageHeader, Spinner, Textarea } from '@/lib/ui';

export default function AiSettingsPage() {
  const { request } = useAuth();
  const [ai, setAi] = useState<any>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState({ message: '', reply: '', busy: false });

  useEffect(() => {
    request('/store/ai-settings')
      .then(setAi)
      .catch((e) => setError((e as Error).message));
  }, [request]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  };

  const save = async () => {
    try {
      await request('/store/ai-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          assistantName: ai.assistantName,
          persona: ai.persona,
          welcomeMessage: ai.welcomeMessage,
          fallbackMessage: ai.fallbackMessage,
          temperature: Number(ai.temperature),
          allowOrderCreation: ai.allowOrderCreation,
          enabled: ai.enabled,
        }),
      });
      flash('تم حفظ إعدادات المساعد');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const runPreview = async () => {
    setPreview((p) => ({ ...p, busy: true, reply: '' }));
    try {
      const res = await request('/ai/preview', {
        method: 'POST',
        body: JSON.stringify({ message: preview.message }),
      });
      setPreview((p) => ({ ...p, reply: res.reply, busy: false }));
    } catch (err) {
      setPreview((p) => ({ ...p, reply: (err as Error).message, busy: false }));
    }
  };

  if (!ai) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="إعدادات الذكاء الاصطناعي" subtitle="اضبط شخصية المساعد وسلوكه، وجرّبه مباشرة" />

      {error && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-4 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="اسم المساعد">
            <Input value={ai.assistantName || ''} onChange={(e) => setAi({ ...ai, assistantName: e.target.value })} />
          </Field>
          <Field label="درجة الإبداع (0 - 2)">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={ai.temperature}
              onChange={(e) => setAi({ ...ai, temperature: e.target.value })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="شخصية المساعد ونبرته">
              <Textarea rows={2} value={ai.persona || ''} onChange={(e) => setAi({ ...ai, persona: e.target.value })} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="رسالة الترحيب">
              <Textarea
                rows={2}
                value={ai.welcomeMessage || ''}
                onChange={(e) => setAi({ ...ai, welcomeMessage: e.target.value })}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="رسالة تعذّر المعرفة (تُقال عند غياب المعلومة)">
              <Textarea
                rows={2}
                value={ai.fallbackMessage || ''}
                onChange={(e) => setAi({ ...ai, fallbackMessage: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!ai.enabled} onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
            المساعد مُفعّل
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!ai.allowOrderCreation}
              onChange={(e) => setAi({ ...ai, allowOrderCreation: e.target.checked })}
            />
            السماح بإنشاء الطلبات
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={save}>حفظ</Button>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-medium text-slate-700">جرّب المساعد</p>
        <div className="flex gap-2">
          <Input
            value={preview.message}
            onChange={(e) => setPreview({ ...preview, message: e.target.value })}
            placeholder="اكتب رسالة عميل تجريبية..."
          />
          <Button onClick={runPreview} disabled={preview.busy || !preview.message}>
            {preview.busy ? '...' : 'إرسال'}
          </Button>
        </div>
        {preview.reply && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{preview.reply}</div>
        )}
      </Card>
    </div>
  );
}
