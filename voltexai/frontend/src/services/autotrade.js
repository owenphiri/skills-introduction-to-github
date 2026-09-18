// src/services/autotrade.js — scanner-anchored, risk-gated auto-executor client
import { api } from "./api";

export const autotradeService = {
  status: () => api.get("/api/autotrade/status"),               // public read
  run: ({ assetClass = "all", timeframe, htf } = {}) => {       // auth required
    const q = new URLSearchParams({ asset_class: assetClass });
    if (timeframe) q.set("timeframe", timeframe);
    if (htf) q.set("htf", htf);
    return api.post(`/api/autotrade/run?${q.toString()}`);
  },
  positions: () => api.get("/api/autotrade/positions"),          // auth required
  close: (id) => api.post(`/api/autotrade/close/${id}`),         // auth required
};
