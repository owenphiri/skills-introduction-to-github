// src/services/results.js — global Results wall (client wins) client
import { api } from "./api";

export const resultsService = {
  feed: ({ market = "", limit = 40, verified = false } = {}) =>
    api.get(`/api/results/feed?limit=${limit}${market ? `&market=${market}` : ""}${verified ? "&verified=true" : ""}`),
  post: (payload) => api.post("/api/results", payload),      // auth required
  like: (id) => api.post(`/api/results/${id}/like`),          // auth required
};
