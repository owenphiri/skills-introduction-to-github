// src/services/kyc.js — identity verification client
import { api } from "./api";

export const kycService = {
  status: () => api.get("/api/kyc/status"),
  submit: (payload) => api.post("/api/kyc/submit", payload),
  // admin
  pending: () => api.get("/api/kyc/pending"),
  decide: (userId, decision, reason) =>
    api.post(`/api/kyc/${userId}/decision`, { decision, reason }),
};
