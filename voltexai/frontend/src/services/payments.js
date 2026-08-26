// src/services/payments.js
import { api } from "./api";

export const paymentsService = {
  // Returns { billing: { months_free, discount_pct, label }, plans: [...] }
  listPlans: () => api.get("/api/payments/plans"),

  // Stripe (international cards / USD). interval: "month" | "year"
  stripeCheckout: (plan, interval = "month") =>
    api.post("/api/payments/stripe/checkout", { plan, interval }),

  // Flutterwave (African mobile money + cards in ZMW/NGN/KES/UGX)
  flutterwaveCheckout: ({ plan, interval = "month", currency = "ZMW", phone }) =>
    api.post("/api/payments/flutterwave/checkout", { plan, interval, currency, phone }),

  cancel: () => api.post("/api/payments/cancel"),
};
