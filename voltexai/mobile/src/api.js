// VoltexAI mobile — API client (shared with the web backend)
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export const API_BASE =
  Constants.expoConfig?.extra?.apiUrl || "http://localhost:8000";

const ACCESS = "voltexai_access";
const REFRESH = "voltexai_refresh";

export const tokens = {
  async get() {
    return {
      access: await AsyncStorage.getItem(ACCESS),
      refresh: await AsyncStorage.getItem(REFRESH),
    };
  },
  async set(access, refresh) {
    if (access) await AsyncStorage.setItem(ACCESS, access);
    if (refresh) await AsyncStorage.setItem(REFRESH, refresh);
  },
  async clear() {
    await AsyncStorage.multiRemove([ACCESS, REFRESH]);
  },
};

async function request(path, { method = "GET", body } = {}) {
  const { access } = await tokens.get();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.detail) || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // public market + signal + directory data
  quotes: (assetClass = "all") => request(`/api/markets/quotes?asset_class=${assetClass}`),
  candles: (s, tf = "M15") => request(`/api/markets/candles/${s}?timeframe=${tf}&count=80`),
  movers: () => request("/api/markets/movers?limit=5"),
  signals: (assetClass = "all", tf = "M15", min = 4) =>
    request(`/api/signals?asset_class=${assetClass}&timeframe=${tf}&min_confidence=${min}`),
  propFirms: () => request("/api/directory/prop-firms"),
  brokers: () => request("/api/directory/brokers?africa_only=true"),
  fund: () => request("/api/fund/summary"),

  // auth
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload }),
  me: () => request("/api/auth/me"),

  // AI (auth required)
  chat: (message, mode = "terminal", conversation_id = null) =>
    request("/api/ai/chat", { method: "POST", body: { message, mode, conversation_id } }),
};
