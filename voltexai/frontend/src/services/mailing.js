// src/services/mailing.js — newsletter subscription client
import { api } from "./api";

export const mailingService = {
  subscribe: (email, name, source = "footer") =>
    api.post("/api/mailing/subscribe", { email, name, source }),
};
