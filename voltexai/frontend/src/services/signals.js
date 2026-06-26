// src/services/signals.js — algorithmic signal scanner client (public endpoints)
import { api } from "./api";

export const signalsService = {
  board: ({ timeframe = "M15", minConfidence = 4, limit = 12 } = {}) =>
    api.get(`/api/signals/board/top?timeframe=${timeframe}&min_confidence=${minConfidence}&limit=${limit}`),

  scan: ({ assetClass = "all", timeframe = "M15", minConfidence = 4 } = {}) =>
    api.get(`/api/signals?asset_class=${assetClass}&timeframe=${timeframe}&min_confidence=${minConfidence}`),

  one: (symbol, timeframe = "M15") =>
    api.get(`/api/signals/${symbol}?timeframe=${timeframe}`),
};
