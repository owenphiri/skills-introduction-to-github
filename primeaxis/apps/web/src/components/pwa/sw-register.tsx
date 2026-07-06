'use client';

import { useEffect } from 'react';

/** Registers /sw.js once the page is interactive. */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline shell is progressive enhancement — never block the app */
      });
    }
  }, []);
  return null;
}
