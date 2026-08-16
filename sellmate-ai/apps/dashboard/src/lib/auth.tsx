'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BASE = `${API}/api/v1`;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  merchantId: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  request: <T = any>(path: string, init?: RequestInit) => Promise<T>;
}

export interface RegisterPayload {
  storeName: string;
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('sm_access');
    const r = localStorage.getItem('sm_refresh');
    const u = localStorage.getItem('sm_user');
    if (t) {
      setToken(t);
      setRefresh(r);
      if (u) setUser(JSON.parse(u));
    }
    setLoading(false);
  }, []);

  const persist = (access: string, refreshTok: string | null, u: AuthUser | null) => {
    localStorage.setItem('sm_access', access);
    if (refreshTok) localStorage.setItem('sm_refresh', refreshTok);
    if (u) localStorage.setItem('sm_user', JSON.stringify(u));
    setToken(access);
    setRefresh(refreshTok);
    setUser(u);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('sm_access');
    localStorage.removeItem('sm_refresh');
    localStorage.removeItem('sm_user');
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

      let res = await doFetch(token ?? localStorage.getItem('sm_access'));

      if (res.status === 401) {
        const storedRefresh = refresh ?? localStorage.getItem('sm_refresh');
        if (storedRefresh) {
          const rr = await fetch(`${BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          });
          if (rr.ok) {
            const data = await rr.json();
            persist(data.accessToken, data.refreshToken, data.user);
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
    [token, refresh, logout],
  );

  const login = async (email: string, password: string) => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'فشل تسجيل الدخول');
    persist(data.accessToken, data.refreshToken, data.user);
    router.push('/dashboard');
  };

  const register = async (payload: RegisterPayload) => {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        Array.isArray(data.message) ? data.message.join('، ') : data.message || 'فشل التسجيل',
      );
    persist(data.accessToken, data.refreshToken, data.user);
    router.push('/dashboard');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, request }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
