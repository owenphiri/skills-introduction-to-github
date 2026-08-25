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

export const resourcesService = {
  list: (category = "all") => api.get(`/api/resources?category=${category}`),
  calendar: (days = 7) => api.get(`/api/resources/calendar?days=${days}`),
};

export const travelService = {
  list: (type = "all") => api.get(`/api/travel?type=${type}`),
  rsvp: (id, payload) => api.post(`/api/travel/${id}/rsvp`, payload),
};

export const communityService = {
  feed: (limit = 30) => api.get(`/api/community/feed?limit=${limit}`),
  post: (body) => api.post("/api/community/posts", { body }),
  like: (id) => api.post(`/api/community/posts/${id}/like`, {}),
};
