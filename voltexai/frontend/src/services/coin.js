// src/services/coin.js — Voltex Coin (VXC) client
import { api } from "./api";

export const coinService = {
  info: () => api.get("/api/coin/info"),
  wallet: () => api.get("/api/coin/wallet"),
  checkin: () => api.post("/api/coin/checkin", {}),
  redeem: (amount, purpose = "wallet_credit") =>
    api.post("/api/coin/redeem", { amount, purpose }),

  // admin
  adminStats: () => api.get("/api/admin/coins/stats"),
  adminUser: (q) => api.get(`/api/admin/coins/user?q=${encodeURIComponent(q)}`),
  adminAdjust: (userQuery, amount, reason) =>
    api.post("/api/admin/coins/adjust", { user_query: userQuery, amount, reason }),
};
