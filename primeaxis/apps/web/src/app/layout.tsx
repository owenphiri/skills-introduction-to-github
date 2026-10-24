import type { Metadata, Viewport } from 'next';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { SwRegister } from '@/components/pwa/sw-register';
import { brand } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${brand.name} — Smart Poultry Farming`,
    template: `%s · ${brand.name}`,
  },
  description: brand.tagline,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // draw behind notches; safe-area handled in CSS
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <SwRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
