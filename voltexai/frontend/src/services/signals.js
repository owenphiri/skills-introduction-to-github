// src/services/signals.js — algorithmic signal scanner client (public endpoints)
import { api } from "./api";

export const signalsService = {
  board: ({ timeframe = "M15", minConfidence = 4, limit = 12 } = {}) =>
    api.get(`/api/signals/board/top?timeframe=${timeframe}&min_confidence=${minConfidence}&limit=${limit}`),

  scan: ({ assetClass = "all", timeframe = "M15", minConfidence = 4 } = {}) =>
    api.get(`/api/signals?asset_class=${assetClass}&timeframe=${timeframe}&min_confidence=${minConfidence}`),

  // Wide-scope quality scan: high-grade, HTF-confirmed, execution-ready trades
  quality: ({ assetClass = "all", timeframe = "M15", htf = "H1", minGrade = "A", minRr = 1.8, limit = 24 } = {}) =>
    api.get(`/api/signals/quality?asset_class=${assetClass}&timeframe=${timeframe}&htf=${htf}&min_grade=${encodeURIComponent(minGrade)}&min_rr=${minRr}&limit=${limit}`),

  one: (symbol, timeframe = "M15") =>
    api.get(`/api/signals/${symbol}?timeframe=${timeframe}`),

  // AI-narrated "why" (Claude when the key is set, deterministic otherwise). Auth required.
  rationale: (symbol, timeframe = "M15") =>
    api.get(`/api/signals/${symbol}/rationale?timeframe=${timeframe}`),

  // Top-down multi-timeframe read: HTF bias -> LTF entry
  topdown: (symbol, mode = "day") =>
    api.get(`/api/signals/topdown/${symbol}?mode=${mode}`),
};
