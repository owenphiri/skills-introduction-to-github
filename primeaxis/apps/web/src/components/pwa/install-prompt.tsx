'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { brand } from '@/lib/brand';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA install prompt (deliverable 8). Chrome/Edge/Android fire
 * `beforeinstallprompt`; we stash it and show our own banner. iOS Safari has
 * no event — we show "Add to Home Screen" instructions instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('primeaxis.installDismissed')) return;
    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (isIos && !standalone) setShowIos(true);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('primeaxis.installDismissed', '1');
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setDeferred(null);
    dismiss();
  };

  if (dismissed || (!deferred && !showIos)) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-card border border-border bg-surface p-4 shadow-lg md:bottom-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>🐔</span>
        <div className="flex-1">
          <p className="text-sm font-medium">Install {brand.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deferred
              ? 'Get the app on your home screen — works offline in the poultry house.'
              : 'On iPhone: tap Share, then "Add to Home Screen".'}
          </p>
          {deferred && (
            <Button size="sm" className="mt-2" onClick={install}>
              <Download className="size-4" /> Install app
            </Button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-faint-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
