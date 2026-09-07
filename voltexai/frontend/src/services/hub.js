// src/services/hub.js — sentiment, live sessions, resources, travel, community
import { api } from "./api";

export const sentimentService = {
  overview: () => api.get("/api/sentiment"),
};

export const dashboardService = {
  snapshot: () => api.get("/api/dashboard"),
};

export const subscribersService = {
  live: () => api.get("/api/live/subscribers"),
};

export const easService = {
  fleet: () => api.get("/api/eas"),
};

export const referralsService = {
  me: () => api.get("/api/referrals/me"),
  track: (code) => api.post("/api/referrals/track", { code }),
  leaderboard: () => api.get("/api/referrals/leaderboard"),
};

export const adminService = {
  analytics: () => api.get("/api/admin/analytics"),
  // Results wall moderation
  results: (onlyUnverified = false) =>
    api.get(`/api/admin/results?limit=200${onlyUnverified ? "&only_unverified=true" : ""}`),
  verifyResult: (id, verified) => api.post(`/api/admin/results/${id}/verify`, { verified }),
  deleteResult: (id) => api.del(`/api/admin/results/${id}`),
};

export const patternsService = {
  detect: (symbol, timeframe) => api.get(`/api/patterns?symbol=${symbol}&timeframe=${timeframe}`),
  confluence: (symbol) => api.get(`/api/patterns/confluence?symbol=${symbol}`),
};

export const proSignalsService = {
  feed: (limit = 20) => api.get(`/api/pro-signals/feed?limit=${limit}`),
  performance: () => api.get("/api/pro-signals/performance"),
  one: (uuid) => api.get(`/api/pro-signals/${uuid}`),
  rlModel: () => api.get("/api/pro-signals/rl/model"),
  // admin (server enforces admin role)
  create: (payload) => api.post("/api/pro-signals", payload),
  event: (uuid, body) => api.post(`/api/pro-signals/${uuid}/events`, body),
};

export const sessionsService = {
  status: () => api.get("/api/sessions"),
};

export const newsService = {
  status: (horizonDays = 10) => api.get(`/api/news?horizon_days=${horizonDays}`),
};

export const resourcesService = {
  list: (category = "all") => api.get(`/api/resources?category=${category}`),
  calendar: (days = 7) => api.get(`/api/resources/calendar?days=${days}`),
};

export const travelService = {
  list: (type = "all") => api.get(`/api/travel?type=${type}`),
  rsvp: (id, payload) => api.post(`/api/travel/${id}/rsvp`, payload),
};

export const communityService = {
  feed: (limit = 30, topic) =>
    api.get(`/api/community/feed?limit=${limit}${topic ? `&topic=${encodeURIComponent(topic)}` : ""}`),
  post: (body, topic) => api.post("/api/community/posts", { body, topic }),
  like: (id) => api.post(`/api/community/posts/${id}/like`, {}),
};
