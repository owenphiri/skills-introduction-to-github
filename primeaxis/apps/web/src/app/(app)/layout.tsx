'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BottomTabs, Sidebar } from '@/components/layout/sidebar';
import { session } from '@/lib/api';

/**
 * Authenticated shell: sidebar on desktop, bottom tabs on mobile.
 * Each page renders its own <Topbar> so it can pass live-connection state.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!session.get()) router.replace('/sign-in');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>
      <BottomTabs />
    </div>
  );
}
