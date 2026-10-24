'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bird,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
} from 'lucide-react';
import { brand } from '@/lib/brand';
import { cn } from '@/lib/utils';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/flocks', label: 'Flocks', Icon: Bird },
  { href: '/inventory', label: 'Inventory', Icon: Package },
  { href: '/reports', label: 'Reports', Icon: FileBarChart },
  { href: '/map', label: 'Map', Icon: MapPin },
  { href: '/billing', label: 'Billing', Icon: CreditCard },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

/** Desktop sidebar. On mobile, BottomTabs replaces it (see layout). */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="text-xl">🐔</span>
        <span className="font-semibold">{brand.name}</span>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-card px-3 py-2.5 text-sm',
              pathname.startsWith(href)
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:bg-surface-2',
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <p className="px-5 py-4 text-xs text-faint-foreground">© {brand.company}</p>
    </aside>
  );
}

/** Mobile bottom tab bar — the 5 most-used destinations, 44px+ targets. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {NAV.slice(0, 5).map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
            pathname.startsWith(href) ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
