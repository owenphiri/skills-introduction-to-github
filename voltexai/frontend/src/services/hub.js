// src/services/hub.js — sentiment, live sessions, resources, travel, community
import { api } from "./api";

export const sentimentService = {
  overview: () => api.get("/api/sentiment"),
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
