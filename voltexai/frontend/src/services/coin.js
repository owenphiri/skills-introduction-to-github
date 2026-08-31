// src/services/coin.js — Voltex Coin (VXC) client
import { api } from "./api";

export const coinService = {
  info: () => api.get("/api/coin/info"),
  wallet: () => api.get("/api/coin/wallet"),
  checkin: () => api.post("/api/coin/checkin", {}),
  redeem: (amount, purpose = "wallet_credit") =>
    api.post("/api/coin/redeem", { amount, purpose }),
};
