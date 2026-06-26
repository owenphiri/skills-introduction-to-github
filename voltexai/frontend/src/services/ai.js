// src/services/ai.js
import { api } from "./api";

export const aiService = {
  chat: ({ message, mode = "terminal", conversation_id = null }) =>
    api.post("/api/ai/chat", { message, mode, conversation_id }),

  stream: ({ message, mode = "terminal", conversation_id = null }, callbacks) =>
    api.stream("/api/ai/stream",
      { message, mode, conversation_id },
      callbacks.onDelta, callbacks.onDone, callbacks.onError),

  signal: ({ pair, timeframe = "M15", context = "" }) =>
    api.post("/api/ai/signal", { pair, timeframe, context }),

  analyzeChart: ({ image_b64, media_type = "image/png", instruction, pair, conversation_id }) =>
    api.post("/api/ai/analyze-chart",
      { image_b64, media_type, instruction, pair, conversation_id }),

  quota: () => api.get("/api/ai/quota"),

  listConversations: () => api.get("/api/ai/conversations"),
  getConversation: (id) => api.get(`/api/ai/conversations/${id}`),
  deleteConversation: (id) => api.del(`/api/ai/conversations/${id}`),
};
