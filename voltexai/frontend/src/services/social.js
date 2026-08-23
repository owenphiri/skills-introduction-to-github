// src/services/social.js — social proof + testimonials
import { api } from "./api";

export const socialService = {
  testimonials: () => api.get("/api/social/testimonials"),
  proof: () => api.get("/api/social/proof"),
};
