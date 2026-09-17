// src/services/liquidity.js — ICT liquidity + score-backtest client
import { api } from "./api";

export const liquidityService = {
  map: (symbol, timeframe = "M15") =>
    api.get(`/api/liquidity/map/${symbol}?timeframe=${timeframe}`),
  assess: (symbol, { timeframe = "M15", direction } = {}) => {
    const q = new URLSearchParams({ timeframe });
    if (direction) q.set("direction", direction);
    return api.get(`/api/liquidity/assess/${symbol}?${q.toString()}`);
  },
  newsBoard: (timeframe = "M15") => api.get(`/api/liquidity/news?timeframe=${timeframe}`),
  backtest: (symbol, { timeframe = "M15", bars = 700 } = {}) =>
    api.get(`/api/liquidity/backtest/${symbol}?timeframe=${timeframe}&bars=${bars}`),
};
