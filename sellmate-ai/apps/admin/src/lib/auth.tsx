'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BASE = `${API}/api/v1`;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isPlatformAdmin?: boolean;
}

interface AuthContextValue {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  request: <T = any>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('sm_admin_access');
    const r = localStorage.getItem('sm_admin_refresh');
    const u = localStorage.getItem('sm_admin_user');
    if (t) {
      setToken(t);
      setRefresh(r);
      if (u) setUser(JSON.parse(u));
    }
    setLoading(false);
  }, []);

  const persist = (access: string, refreshTok: string | null, u: AdminUser | null) => {
    localStorage.setItem('sm_admin_access', access);
    if (refreshTok) localStorage.setItem('sm_admin_refresh', refreshTok);
    if (u) localStorage.setItem('sm_admin_user', JSON.stringify(u));
    setToken(access);
    setRefresh(refreshTok);
    setUser(u);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('sm_admin_access');
    localStorage.removeItem('sm_admin_refresh');
    localStorage.removeItem('sm_admin_user');
    setToken(null);
    setRefresh(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const doFetch = (tok: string | null) =>
        fetch(`${BASE}${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init.headers || {}),
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          },
        });

      let res = await doFetch(token ?? localStorage.getItem('sm_admin_access'));

      if (res.status === 401) {
        const storedRefresh = refresh ?? localStorage.getItem('sm_admin_refresh');
        if (storedRefresh) {
          const rr = await fetch(`${BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          });
          if (rr.ok) {
            const data = await rr.json();
            persist(data.accessToken, data.refreshToken, user);
            res = await doFetch(data.accessToken);
          } else {
            logout();
            throw new Error('انتهت الجلسة، يرجى تسجيل الدخول من جديد');
          }
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'حدث خطأ' }));
        throw new Error(
          Array.isArray(err.message) ? err.message.join('، ') : err.message || 'حدث خطأ',
        );
      }
      if (res.status === 204) return undefined as unknown as T;
      return res.json();
    },
    [token, refresh, user, logout],
  );

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'فشل تسجيل الدخول');

    // نتحقق أن الحساب مشرف منصّة عبر /auth/me قبل السماح بالدخول للوحة.
    const me = await fetch(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    const meData = await me.json().catch(() => ({}));
    if (!me.ok || !meData?.user?.isPlatformAdmin) {
      throw new Error('هذا الحساب ليس مشرف منصّة. الدخول مقصور على المشرفين.');
    }

    persist(data.accessToken, data.refreshToken, meData.user);
    router.push('/overview');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, request }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
