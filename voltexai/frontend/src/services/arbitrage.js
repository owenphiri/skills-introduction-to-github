// src/services/arbitrage.js — fee-aware arbitrage / spread scanner client
import { api } from "./api";

export const arbitrageService = {
  // public reads
  scan: ({ minNetBps = 0, notional = 10000, feeTierBps } = {}) => {
    const q = new URLSearchParams({ min_net_bps: String(minNetBps), notional: String(notional) });
    if (feeTierBps !== undefined && feeTierBps !== null && feeTierBps !== "")
      q.set("fee_tier_bps", String(feeTierBps));
    return api.get(`/api/arbitrage/scan?${q.toString()}`);
  },
  quotes: (symbol) => api.get(`/api/arbitrage/quotes/${symbol}`),
  status: () => api.get("/api/arbitrage/status"),

  // auth required (paper executor)
  run: ({ minNetBps = 0, notional = 10000, feeTierBps } = {}) => {
    const q = new URLSearchParams({ min_net_bps: String(minNetBps), notional: String(notional) });
    if (feeTierBps !== undefined && feeTierBps !== null && feeTierBps !== "")
      q.set("fee_tier_bps", String(feeTierBps));
    return api.post(`/api/arbitrage/run?${q.toString()}`);
  },
  close: (id) => api.post(`/api/arbitrage/close/${id}`),
};
