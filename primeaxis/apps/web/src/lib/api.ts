'use client';

/**
 * Typed API client with automatic refresh-token rotation.
 * All auth state lives here — swapping to Clerk/NextAuth later means
 * replacing this file and nothing else.
 */
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  farms: { id: string; name: string; role: string }[];
}

const KEY = 'primeaxis.session';

export const session = {
  get(): Session | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  },
  set(s: Session | null) {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const s = session.get();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(s ? { Authorization: `Bearer ${s.accessToken}` } : {}),
      ...init.headers,
    },
  });

  // Access token expired → rotate the refresh token once, then replay.
  if (res.status === 401 && s?.refreshToken && retry) {
    const r = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    });
    if (r.ok) {
      session.set({ ...s, ...(await r.json()) });
      return request<T>(path, init, false);
    }
    session.set(null);
    window.location.href = '/sign-in';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
};

/** Currently selected farm (drives every farm-scoped screen). */
const FARM_KEY = 'primeaxis.farmId';
export const activeFarm = {
  get: () =>
    (typeof window !== 'undefined' && localStorage.getItem(FARM_KEY)) ||
    session.get()?.farms[0]?.id ||
    null,
  set: (id: string) => localStorage.setItem(FARM_KEY, id),
};
