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
  completeLesson: (courseId, lessonIdx) =>
    api.post(`/api/academy/courses/${courseId}/lessons/${lessonIdx}/complete`, {}),
};

export const storeService = {
  list: (category = "all") => api.get(`/api/store?category=${category}`),
  // Voltex Pay one-time checkout for a store product (VXC auto-applied by default)
  checkout: ({ productId, provider, currency = "ZMW", phone, applyCoins = true }) =>
    api.post("/api/payments/store/checkout",
             { product_id: productId, provider, currency, phone, apply_coins: applyCoins }),
};

export const payService = {
  overview: () => api.get("/api/pay"),
};

export const competitionService = {
  list: () => api.get("/api/competition"),
  join: (id) => api.post(`/api/competition/${id}/join`, {}),
  leaderboard: (id) => api.get(`/api/competition/${id}/leaderboard`),
};

export const geoService = {
  config: (country) => api.get(`/api/geo/config${country ? `?country=${encodeURIComponent(country)}` : ""}`),
};

export const realEstateService = {
  overview: (market = "all") => api.get(`/api/realestate?market=${encodeURIComponent(market)}`),
  interest: (payload) => api.post("/api/realestate/interest", payload),
};
