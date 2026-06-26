// src/services/payments.js
import { api } from "./api";

export const paymentsService = {
  listPlans: () => api.get("/api/payments/plans"),

  // Stripe (international cards / USD)
  stripeCheckout: (plan) =>
    api.post("/api/payments/stripe/checkout", { plan }),

  // Flutterwave (African mobile money + cards in ZMW/NGN/KES/UGX)
  flutterwaveCheckout: ({ plan, currency = "ZMW", phone }) =>
    api.post("/api/payments/flutterwave/checkout", { plan, currency, phone }),

  cancel: () => api.post("/api/payments/cancel"),
};
