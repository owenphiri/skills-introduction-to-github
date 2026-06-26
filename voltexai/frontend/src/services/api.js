// src/services/api.js
// VoltexAI - HTTP client with automatic JWT injection and 401 -> refresh flow.

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "voltexai_access";
const REFRESH_KEY = "voltexai_refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access, refresh) {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;          // de-dupe concurrent refreshes
  const refresh = tokenStore.refresh;
  if (!refresh) throw new Error("No refresh token");

  refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  })
    .then(async (r) => {
      if (!r.ok) {
        tokenStore.clear();
        throw new Error("Refresh failed");
      }
      const data = await r.json();
      tokenStore.set(data.access_token, data.refresh_token);
      return data.access_token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function request(path, { method = "GET", body, headers = {}, retry = true } = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  const access = tokenStore.access;
  if (access) opts.headers["Authorization"] = `Bearer ${access}`;
  if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);

  let res = await fetch(`${API_BASE}${path}`, opts);

  if (res.status === 401 && retry && tokenStore.refresh) {
    try {
      const newToken = await refreshAccessToken();
      opts.headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, opts);
    } catch {
      // fall through; caller sees 401 and routes to login
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error((data && data.detail) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p, h) => request(p, { method: "GET", headers: h }),
  post: (p, body, h) => request(p, { method: "POST", body, headers: h }),
  put: (p, body, h) => request(p, { method: "PUT", body, headers: h }),
  del: (p, h) => request(p, { method: "DELETE", headers: h }),

  // SSE streaming for the Terminal page
  async stream(path, body, onDelta, onDone, onError) {
    const access = tokenStore.access;
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: access ? `Bearer ${access}` : "",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      onError && onError(new Error(`HTTP ${res.status}`));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const evt of events) {
        if (!evt.startsWith("data: ")) continue;
        try {
          const payload = JSON.parse(evt.slice(6));
          if (payload.type === "delta") onDelta && onDelta(payload.text);
          else if (payload.type === "done") onDone && onDone(payload);
          else if (payload.type === "error") onError && onError(new Error(payload.message));
        } catch {
          /* ignore parse errors */
        }
      }
    }
  },
};

export const API_BASE_URL = API_BASE;
