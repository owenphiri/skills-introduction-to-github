// src/services/auth.js
import { api, tokenStore } from "./api";

export const authService = {
  async register({ email, password, full_name, country, phone }) {
    const data = await api.post("/api/auth/register", {
      email, password, full_name, country, phone,
    });
    tokenStore.set(data.access_token, data.refresh_token);
    return data;
  },

  async login({ email, password }) {
    const data = await api.post("/api/auth/login", { email, password });
    tokenStore.set(data.access_token, data.refresh_token);
    return data;
  },

  async logout() {
    try { await api.post("/api/auth/logout"); } catch { /* ignore */ }
    tokenStore.clear();
  },

  async me() {
    return api.get("/api/auth/me");
  },

  async forgot(email) {
    return api.post("/api/auth/forgot", { email });
  },

  async reset(token, new_password) {
    return api.post("/api/auth/reset", { token, new_password });
  },

  async verify(token) {
    return api.post("/api/auth/verify", { token });
  },

  isAuthenticated() {
    return !!tokenStore.access;
  },
};
