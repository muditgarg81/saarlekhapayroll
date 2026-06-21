'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore(s => s.token);
  const _hasHydrated = useAuthStore(s => s._hasHydrated);

  useEffect(() => {
    if (_hasHydrated && !token) {
      router.push('/login');
    }
  }, [_hasHydrated, token, router]);

  if (!_hasHydrated || !token) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
