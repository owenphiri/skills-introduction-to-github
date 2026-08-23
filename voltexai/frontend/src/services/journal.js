// src/services/journal.js — advanced trade journal (auth)
import { api } from "./api";

export const journalService = {
  load: () => api.get("/api/journal"),
  add: (trade) => api.post("/api/journal", trade),
  remove: (id) => api.del(`/api/journal/${id}`),
};
