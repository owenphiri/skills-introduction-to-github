// src/services/markets.js — live market data client (public endpoints)
import { api, API_BASE_URL } from "./api";

export const marketsService = {
  instruments: (assetClass = "all") =>
    api.get(`/api/markets/instruments?asset_class=${assetClass}`),

  quotes: ({ symbols, assetClass = "all" } = {}) => {
    const qs = symbols?.length
      ? `symbols=${symbols.join(",")}`
      : `asset_class=${assetClass}`;
    return api.get(`/api/markets/quotes?${qs}`);
  },

  quote: (symbol) => api.get(`/api/markets/quote/${symbol}`),

  candles: (symbol, timeframe = "M15", count = 200) =>
    api.get(`/api/markets/candles/${symbol}?timeframe=${timeframe}&count=${count}`),

  movers: (limit = 6) => api.get(`/api/markets/movers?limit=${limit}`),

  // WebSocket live stream. Returns the socket; caller wires onmessage/close.
  openStream(symbols, onQuotes) {
    const wsBase = API_BASE_URL.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/api/markets/stream`);
    ws.onopen = () => symbols?.length && ws.send(JSON.stringify({ symbols }));
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "quotes") onQuotes(msg.quotes);
      } catch {
        /* ignore */
      }
    };
    return ws;
  },
};
