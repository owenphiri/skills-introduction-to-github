// src/services/ecosystem.js — Voltex ecosystem clients
import { api } from "./api";

export const ecosystemService = {
  ecosystem: () => api.get("/api/ecosystem"),
  gamification: () => api.get("/api/gamification/me"),
};

export const academyService = {
  overview: () => api.get("/api/academy/overview"),
  courses: (track = "all") => api.get(`/api/academy/courses?track=${track}`),
  course: (id) => api.get(`/api/academy/courses/${id}`),
};

export const storeService = {
  list: (category = "all") => api.get(`/api/store?category=${category}`),
};

export const payService = {
  overview: () => api.get("/api/pay"),
};

export const competitionService = {
  list: () => api.get("/api/competition"),
  join: (id) => api.post(`/api/competition/${id}/join`, {}),
  leaderboard: (id) => api.get(`/api/competition/${id}/leaderboard`),
};
