'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api, session, type Session } from '@/lib/api';
import { brand } from '@/lib/brand';

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const s = await api.post<Session>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        data,
      );
      session.set(s);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
        <span className="text-2xl">🐔</span> {brand.name}
      </Link>

      <h1 className="text-xl font-semibold">
        {mode === 'login' ? 'Welcome back' : 'Create your farm'}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'register' && (
          <>
            <div>
              <Label htmlFor="fullName">Your name</Label>
              <Input id="fullName" name="fullName" required autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="farmName">Farm name</Label>
              <Input id="farmName" name="farmName" required placeholder="e.g. Kasama Poultry" />
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="text-sm text-critical">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {mode === 'login' ? 'New here? Create a free account' : 'Have an account? Sign in'}
      </button>
    </main>
  );
}
