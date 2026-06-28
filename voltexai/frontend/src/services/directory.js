// src/services/directory.js — prop firms, brokers, and the AUM/fund client
import { api } from "./api";

export const directoryService = {
  propFirms: (assetClass = "all") =>
    api.get(`/api/directory/prop-firms?asset_class=${assetClass}`),
  propFirm: (id) => api.get(`/api/directory/prop-firms/${id}`),

  brokers: ({ assetClass = "all", africaOnly = false } = {}) =>
    api.get(`/api/directory/brokers?asset_class=${assetClass}&africa_only=${africaOnly}`),
  broker: (id) => api.get(`/api/directory/brokers/${id}`),
};

export const fundService = {
  summary: () => api.get("/api/fund/summary"),
  performance: () => api.get("/api/fund/performance"),
  pitch: () => api.get("/api/fund/pitch"),
  enquire: (payload) => api.post("/api/fund/enquire", payload),
};
