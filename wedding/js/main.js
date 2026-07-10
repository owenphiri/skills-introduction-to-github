/* =========================================================================
   Owen & Beauty — The Bold & The Beautiful
   Site configuration + behaviour. Everything you may need to change lives
   in the CONFIG block below.
   ========================================================================= */

const CONFIG = {
  // Wedding date/time in Zambia (CAT, UTC+02:00)
  weddingISO: "2026-12-12T10:00:00+02:00",
  weddingDisplay: "Saturday, 12 December 2026 · Kasama, Zambia",

  // WhatsApp number in international format WITHOUT "+" (Zambia = 260…).
  // TODO: replace with the couple's real number before going live.
  whatsappNumber: "260970000000",
  whatsappGreeting:
    "Hello! I'm interested in the wedding of Owen & Beauty. I'd like to know more about...",

  // Payment provider: "flutterwave" (inline checkout popup) or
  // "moneyunify" (direct USSD prompt, no popup). See wedding/README.md.
  paymentProvider: "flutterwave",
  paymentCurrency: "ZMW",

  // Flutterwave PUBLIC key (safe to expose — it is a publishable key).
  // Use your TEST key (FLWPUBK_TEST-…) while testing, then swap for the
  // LIVE key (FLWPUBK-…) in production.
  flutterwavePublicKey: "FLWPUBK_TEST-REPLACE-ME-X",

  // MoneyUnify auth_id from https://dashboard.moneyunify.one — a public
  // merchant identifier (it can only request payments INTO your account).
  moneyUnifyAuthId: "pub_REPLACE-ME",
  moneyUnifyApiBase: "https://api.moneyunify.one",

  // Optional: also POST each RSVP to a backend (see server-example/).
  // Leave empty to deliver via WhatsApp only. Example: "/api/rsvp" when the
  // site is served by charge-server.js, or a full https:// URL.
  rsvpApiUrl: "",
};

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function waLink(text) {
  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(text)}`;
}

/** Normalise a Zambian mobile number to 260XXXXXXXXX; return null if invalid. */
function normalizeZmPhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (/^260(9[5678]|7[5678])\d{7}$/.test(digits)) return digits;
  if (/^0(9[5678]|7[5678])\d{7}$/.test(digits)) return "260" + digits.slice(1);
  if (/^(9[5678]|7[5678])\d{7}$/.test(digits)) return "260" + digits;
  return null;
}

/* ---------- sticky header + mobile nav ---------- */
const header = $("#siteHeader");
const navToggle = $("#navToggle");
const navLinks = $("#navLinks");

window.addEventListener(
  "scroll",
  () => header.classList.toggle("scrolled", window.scrollY > 40),
  { passive: true }
);

navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});
$$("#navLinks a").forEach((a) =>
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  })
);

/* ---------- countdown ---------- */
const weddingTime = new Date(CONFIG.weddingISO).getTime();
$("#heroDateText").textContent = CONFIG.weddingDisplay;

function tickCountdown() {
  const diff = weddingTime - Date.now();
  const el = {
    d: $("#cdDays"),
    h: $("#cdHours"),
    m: $("#cdMins"),
    s: $("#cdSecs"),
  };
  if (diff <= 0) {
    el.d.textContent = "0";
    el.h.textContent = el.m.textContent = el.s.textContent = "00";
    $("#countdown").insertAdjacentHTML(
      "afterend",
      '<p class="hero-tagline">We are married! Thank you for celebrating with us. 💍</p>'
    );
    clearInterval(cdTimer);
    return;
  }
  const pad = (n) => String(n).padStart(2, "0");
  el.d.textContent = Math.floor(diff / 86400000);
  el.h.textContent = pad(Math.floor(diff / 3600000) % 24);
  el.m.textContent = pad(Math.floor(diff / 60000) % 60);
  el.s.textContent = pad(Math.floor(diff / 1000) % 60);
}
const cdTimer = setInterval(tickCountdown, 1000);
tickCountdown();

/* ---------- scroll reveal ---------- */
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
$$(".reveal").forEach((el) => observer.observe(el));

/* ---------- WhatsApp links ---------- */
$("#waFloat").href = waLink(CONFIG.whatsappGreeting);
$("#contactWhatsApp").href = waLink(CONFIG.whatsappGreeting);

/* ---------- RSVP form: draft autosave, remembered submission, WhatsApp delivery ---------- */
const rsvpForm = $("#rsvpForm");
const RSVP_DRAFT_KEY = "wedding_rsvp_draft";
const RSVP_DATA_KEY = "wedding_rsvp_data";
const RSVP_DONE_KEY = "wedding_rsvp_submitted";

function readRsvpForm() {
  return {
    name: $("#rsvpName").value.trim(),
    phone: $("#rsvpPhone").value.trim(),
    email: $("#rsvpEmail").value.trim(),
    guests: $("#rsvpGuests").value,
    message: $("#rsvpMessage").value.trim(),
    events: $$('#rsvpForm input[name="events"]:checked').map((c) => c.value),
  };
}

function fillRsvpForm(data) {
  if (!data) return;
  $("#rsvpName").value = data.name || "";
  $("#rsvpPhone").value = data.phone || "";
  $("#rsvpEmail").value = data.email || "";
  if (data.guests) $("#rsvpGuests").value = data.guests;
  $("#rsvpMessage").value = data.message || "";
  if (Array.isArray(data.events)) {
    $$('#rsvpForm input[name="events"]').forEach((c) => {
      c.checked = data.events.includes(c.value);
    });
  }
}

function lsGet(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (_) {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) { /* private browsing — autosave is best-effort */ }
}

// Auto-save a draft as the guest types, restore it when they come back.
$$("#rsvpForm input, #rsvpForm select, #rsvpForm textarea").forEach((el) => {
  el.addEventListener("input", () => lsSet(RSVP_DRAFT_KEY, readRsvpForm()));
  el.addEventListener("change", () => lsSet(RSVP_DRAFT_KEY, readRsvpForm()));
});

// Success panel shown instead of the form once an RSVP has been sent.
// Built with textContent (never innerHTML) so guest input can't inject markup.
function showRsvpDone(data) {
  let panel = $("#rsvpDone");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "rsvpDone";
    panel.className = "rsvp-form rsvp-done";
    rsvpForm.after(panel);
  }
  panel.replaceChildren();

  const h = document.createElement("p");
  h.className = "rsvp-done-title";
  h.textContent = `🎉 Thank you, ${data.name}! We can't wait to celebrate with you.`;
  const sub = document.createElement("p");
  const n = Number(data.guests) || 1;
  sub.textContent =
    `We've noted ${n} ${n === 1 ? "seat" : "seats"} for: ${(data.events || []).join(", ")}.`;
  const hint = document.createElement("p");
  hint.className = "form-hint";
  hint.textContent =
    "Your RSVP was sent to the couple on WhatsApp — if the chat didn't open, tap Update and send again.";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-outline";
  btn.textContent = "Update my RSVP";
  btn.addEventListener("click", () => {
    localStorage.removeItem(RSVP_DONE_KEY);
    fillRsvpForm(lsGet(RSVP_DATA_KEY));
    panel.hidden = true;
    rsvpForm.hidden = false;
    $("#rsvpName").focus();
  });

  panel.append(h, sub, hint, btn);
  panel.hidden = false;
  rsvpForm.hidden = true;
}

// On load: returning guests see their confirmation; otherwise restore any draft.
if (lsGet(RSVP_DONE_KEY) === true && lsGet(RSVP_DATA_KEY)) {
  showRsvpDone(lsGet(RSVP_DATA_KEY));
} else {
  fillRsvpForm(lsGet(RSVP_DRAFT_KEY));
}

rsvpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const status = $("#rsvpStatus");
  const { name, phone: phoneRaw, email, guests, message, events } = readRsvpForm();

  $$("#rsvpForm input").forEach((i) => i.classList.remove("invalid"));
  status.className = "form-status";

  const fail = (input, msg) => {
    if (input) {
      input.classList.add("invalid");
      input.focus();
    }
    status.textContent = msg;
    status.classList.add("err");
  };

  if (!name) return fail($("#rsvpName"), "Please enter your full name.");
  const phone = normalizeZmPhone(phoneRaw);
  if (!phone)
    return fail(
      $("#rsvpPhone"),
      "Please enter a valid Zambian mobile number (e.g. 0977 123 456)."
    );
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail($("#rsvpEmail"), "That email address doesn't look right.");
  if (events.length === 0)
    return fail(null, "Please select at least one event you will attend.");

  const lines = [
    "💍 *RSVP — Owen & Beauty Wedding*",
    `*Name:* ${name}`,
    `*Phone:* +${phone}`,
    email ? `*Email:* ${email}` : null,
    `*Guests:* ${guests}`,
    `*Attending:* ${events.join(", ")}`,
    message ? `*Message:* ${message}` : null,
  ].filter(Boolean);

  status.textContent = "Opening WhatsApp — press Send to confirm your RSVP. 💛";
  status.classList.add("ok");
  window.open(waLink(lines.join("\n")), "_blank", "noopener");

  const record = { ...readRsvpForm(), submitted_at: new Date().toISOString() };
  lsSet(RSVP_DATA_KEY, record);
  lsSet(RSVP_DONE_KEY, true);
  localStorage.removeItem(RSVP_DRAFT_KEY);
  showRsvpDone(record);
  sendRsvpToServer(record);
});

// Best-effort backup copy to the backend; WhatsApp remains the primary
// delivery, so a failure here must never block or alarm the guest.
async function sendRsvpToServer(data) {
  if (!CONFIG.rsvpApiUrl) return;
  try {
    await fetch(CONFIG.rsvpApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn("RSVP backend unreachable (WhatsApp copy already sent):", err);
  }
}

/* ---------- payment modal + Flutterwave ---------- */
const payModal = $("#payModal");
const paySummary = $("#paySummary");
const payStatus = $("#payStatus");
let selectedTier = null;
let selectedAmount = 0;

$$(".buy-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    selectedTier = btn.dataset.tier;
    selectedAmount = Number(btn.dataset.amount);
    paySummary.textContent = `${selectedTier} — K${selectedAmount} (${CONFIG.paymentCurrency})`;
    payStatus.textContent = "";
    payStatus.className = "form-status";
    updatePayFallbackLink();
    payModal.hidden = false;
    document.body.style.overflow = "hidden";
    $("#payName").focus();
  })
);

function closePayModal() {
  payModal.hidden = true;
  document.body.style.overflow = "";
}
$("#payClose").addEventListener("click", closePayModal);
payModal.addEventListener("click", (e) => {
  if (e.target === payModal) closePayModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !payModal.hidden) closePayModal();
});

function updatePayFallbackLink() {
  const name = $("#payName").value.trim() || "(my name)";
  $("#payWhatsAppFallback").href = waLink(
    `Hello! I'd like to buy a *${selectedTier}* (K${selectedAmount}) for the Owen & Beauty wedding. ` +
      `My name is ${name}. Please send me payment instructions.`
  );
}
$("#payName").addEventListener("input", updatePayFallbackLink);

$("#payForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#payName").value.trim();
  const phoneRaw = $("#payPhone").value.trim();
  const email = $("#payEmail").value.trim();
  const network = $("#payNetwork").value;

  payStatus.className = "form-status";
  $$("#payForm input").forEach((i) => i.classList.remove("invalid"));

  const fail = (input, msg) => {
    if (input) input.classList.add("invalid");
    payStatus.textContent = msg;
    payStatus.classList.add("err");
  };

  if (!name) return fail($("#payName"), "Please enter the name for the card.");
  const phone = normalizeZmPhone(phoneRaw);
  if (!phone)
    return fail($("#payPhone"), "Enter a valid Zambian mobile money number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return fail($("#payEmail"), "That email address doesn't look right.");

  const guest = { name, phone, email, network };
  if (CONFIG.paymentProvider === "moneyunify") {
    payWithMoneyUnify(guest, fail);
  } else {
    payWithFlutterwave(guest, fail);
  }
});

function paySucceeded(guest, reference) {
  payStatus.textContent =
    "✅ Payment received! Your card is reserved — we'll confirm on WhatsApp.";
  payStatus.className = "form-status ok";
  try {
    // Local receipt for the guest; authoritative record is the provider dashboard.
    localStorage.setItem(
      `payment_${reference}`,
      JSON.stringify({ ...guest, tier: selectedTier, amount: selectedAmount, reference, at: new Date().toISOString() })
    );
  } catch (_) { /* private browsing — receipt still goes to WhatsApp */ }
  // Let the couple know immediately, with the transaction reference.
  window.open(
    waLink(
      `✅ *Card purchase* — Owen & Beauty Wedding\n` +
        `*Name:* ${guest.name}\n*Card:* ${selectedTier} (K${selectedAmount})\n` +
        `*Phone:* +${guest.phone}\n*Ref:* ${reference}`
    ),
    "_blank",
    "noopener"
  );
}

/* ----- Provider 1: Flutterwave inline checkout ----- */
function payWithFlutterwave(guest, fail) {
  if (typeof window.FlutterwaveCheckout !== "function") {
    return fail(
      null,
      "Payment service could not load. Please check your connection or use the WhatsApp option below."
    );
  }
  if (CONFIG.flutterwavePublicKey.includes("REPLACE-ME")) {
    return fail(
      null,
      "Online payments are not yet activated. Please use the WhatsApp option below."
    );
  }

  const txRef = `OB-WED-${selectedTier.replace(/\s+/g, "")}-${Date.now()}`;
  const payBtn = $("#payBtn");
  payBtn.disabled = true;
  payStatus.textContent = "Sending payment prompt to your phone…";
  payStatus.classList.add("ok");

  window.FlutterwaveCheckout({
    public_key: CONFIG.flutterwavePublicKey,
    tx_ref: txRef,
    amount: selectedAmount,
    currency: CONFIG.paymentCurrency,
    payment_options: "mobilemoneyzambia",
    customer: {
      email: guest.email || `${guest.phone}@guests.owenandbeauty.wedding`,
      phone_number: guest.phone,
      name: guest.name,
    },
    meta: { tier: selectedTier, network: guest.network },
    customizations: {
      title: "Owen & Beauty Wedding",
      description: `${selectedTier} — invitation card`,
      logo: "",
    },
    callback: (response) => {
      payBtn.disabled = false;
      if (response.status === "successful" || response.status === "completed") {
        paySucceeded(guest, response.tx_ref || txRef);
      } else {
        payStatus.textContent =
          "Payment was not completed. You can try again or pay via WhatsApp below.";
        payStatus.className = "form-status err";
      }
    },
    onclose: () => {
      payBtn.disabled = false;
    },
  });
}

/* ----- Provider 2: MoneyUnify direct charge (USSD prompt, no popup) ----- */
async function payWithMoneyUnify(guest, fail) {
  if (CONFIG.moneyUnifyAuthId.includes("REPLACE-ME")) {
    return fail(
      null,
      "Online payments are not yet activated. Please use the WhatsApp option below."
    );
  }

  const payBtn = $("#payBtn");
  payBtn.disabled = true;
  payStatus.className = "form-status ok";
  payStatus.textContent = "Sending payment prompt to your phone…";

  // MoneyUnify expects the local format, e.g. 0977123456.
  const localPhone = "0" + guest.phone.slice(3);

  const muFail = (msg) => {
    payBtn.disabled = false;
    fail(null, msg);
  };

  let initiated;
  try {
    const res = await fetch(`${CONFIG.moneyUnifyApiBase}/payments/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        from_payer: localPhone,
        amount: String(selectedAmount),
        auth_id: CONFIG.moneyUnifyAuthId,
      }),
    });
    initiated = await res.json();
  } catch (_) {
    return muFail("Payment service unreachable. Check your connection or use the WhatsApp option below.");
  }

  const transactionId = initiated?.data?.transaction_id;
  if (initiated?.isError || !transactionId) {
    return muFail(initiated?.message || "Could not start the payment. Please try again.");
  }

  payStatus.textContent =
    "📲 Prompt sent — approve the payment on your phone with your PIN…";

  // Poll every 3s, give the guest up to 2 minutes to approve.
  const POLL_MS = 3000;
  const MAX_ATTEMPTS = 40;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let verify;
    try {
      const res = await fetch(`${CONFIG.moneyUnifyApiBase}/payments/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          transaction_id: transactionId,
          auth_id: CONFIG.moneyUnifyAuthId,
        }),
      });
      verify = await res.json();
    } catch (_) {
      continue; // transient network blip — keep polling until the deadline
    }
    const status = verify?.data?.status;
    if (status === "successful") {
      payBtn.disabled = false;
      return paySucceeded(guest, transactionId);
    }
    if (status === "failed") {
      return muFail("Payment failed or was declined. You can try again or pay via WhatsApp below.");
    }
    // "initiated"/"pending" (or an unexpected shape) — keep waiting.
  }
  muFail(
    "We couldn't confirm the payment in time. If you approved it, message us on WhatsApp with ref " +
      transactionId +
      " and we'll verify it."
  );
}
