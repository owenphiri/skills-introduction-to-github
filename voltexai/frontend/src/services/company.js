// src/services/company.js — corporate & media content (About, Careers, Press,
// TV, Media, Podcast, Blogs, Offers, Awards, FAQ, Foundation, CSR, Sitemap).
import { api } from "./api";

let _cache = null;

export const companyService = {
  // one snapshot powers every company/media page; cached for the session
  content: async () => {
    if (_cache) return _cache;
    _cache = await api.get("/api/company");
    return _cache;
  },
  apply: (payload) => api.post("/api/careers/apply", payload),
};
