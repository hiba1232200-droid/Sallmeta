'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/lib/ui';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/overview' : '/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}
