'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, Input, Spinner } from '@/lib/ui';

/** خطّاف ترقيم بالمؤشّر: يجلب صفحات ويضيفها، مع دعم البحث/التصفية عبر makePath. */
export function usePaged<T = any>(makePath: (cursor: string | null) => string) {
  const { request } = useAuth();
  const makePathRef = useRef(makePath);
  makePathRef.current = makePath;
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (reset: boolean, cursor: string | null = null) => {
      setLoading(true);
      setError('');
      try {
        const data = await request(makePathRef.current(reset ? null : cursor));
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [request],
  );

  return { items, setItems, nextCursor, loading, error, load };
}

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  empty = 'لا توجد بيانات.',
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: string;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState message={empty} />;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`p-3 text-right font-medium ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`p-3 align-middle ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function Toolbar({
  search,
  onSearch,
  onSubmit,
  children,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  onSubmit?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {onSearch && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.();
          }}
        >
          <Input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="بحث..."
            className="w-56"
          />
          <Button type="submit" variant="outline">
            بحث
          </Button>
        </form>
      )}
      {children}
    </div>
  );
}

export function LoadMore({
  cursor,
  loading,
  onMore,
}: {
  cursor: string | null;
  loading?: boolean;
  onMore: () => void;
}) {
  if (!cursor) return null;
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="outline" onClick={onMore} disabled={loading}>
        {loading ? '...جارٍ' : 'تحميل المزيد'}
      </Button>
    </div>
  );
}
