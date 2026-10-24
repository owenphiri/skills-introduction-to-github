'use client';

import { LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { session } from '@/lib/api';
import { resetSocket } from '@/lib/socket';
import { FarmSwitcher } from './farm-switcher';

export function Topbar({ live }: { live?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('primeaxis.theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('primeaxis.theme', next ? 'dark' : 'light');
  };

  const logout = () => {
    session.set(null);
    resetSocket();
    window.location.href = '/sign-in';
  };

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
      <FarmSwitcher />
      {live != null && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={`size-2 rounded-full ${live ? 'bg-good' : 'bg-faint-foreground'}`}
            aria-hidden
          />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-card p-2 text-muted-foreground hover:bg-surface-2"
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="rounded-card p-2 text-muted-foreground hover:bg-surface-2"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </header>
  );
}
