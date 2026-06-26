// src/services/trade.js — trade execution client (auth required)
import { api } from "./api";

export const tradeService = {
  broker: () => api.get("/api/trade/broker"),
  account: () => api.get("/api/trade/account"),
  positions: () => api.get("/api/trade/positions"),
  orders: (limit = 50) => api.get(`/api/trade/orders?limit=${limit}`),
  placeOrder: (payload) => api.post("/api/trade/orders", payload),
  cancelOrder: (id) => api.post(`/api/trade/orders/${id}/cancel`, {}),
};
