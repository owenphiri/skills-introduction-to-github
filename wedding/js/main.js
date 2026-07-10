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

  // Flutterwave PUBLIC key (safe to expose — it is a publishable key).
  // Use your TEST key (FLWPUBK_TEST-…) while testing, then swap for the
  // LIVE key (FLWPUBK-…) in production. See wedding/README.md.
  flutterwavePublicKey: "FLWPUBK_TEST-REPLACE-ME-X",
  paymentCurrency: "ZMW",
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

/* ---------- RSVP form → WhatsApp ---------- */
$("#rsvpForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const status = $("#rsvpStatus");
  const name = $("#rsvpName").value.trim();
  const phoneRaw = $("#rsvpPhone").value.trim();
  const email = $("#rsvpEmail").value.trim();
  const guests = $("#rsvpGuests").value;
  const message = $("#rsvpMessage").value.trim();
  const events = $$('#rsvpForm input[name="events"]:checked').map((c) => c.value);

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
});

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
      email: email || `${phone}@guests.owenandbeauty.wedding`,
      phone_number: phone,
      name,
    },
    meta: { tier: selectedTier, network },
    customizations: {
      title: "Owen & Beauty Wedding",
      description: `${selectedTier} — invitation card`,
      logo: "",
    },
    callback: (response) => {
      payBtn.disabled = false;
      if (response.status === "successful" || response.status === "completed") {
        payStatus.textContent =
          "✅ Payment received! Your card is reserved — we'll confirm on WhatsApp.";
        payStatus.className = "form-status ok";
        // Let the couple know immediately, with the transaction reference.
        window.open(
          waLink(
            `✅ *Card purchase* — Owen & Beauty Wedding\n` +
              `*Name:* ${name}\n*Card:* ${selectedTier} (K${selectedAmount})\n` +
              `*Phone:* +${phone}\n*Ref:* ${response.tx_ref || txRef}`
          ),
          "_blank",
          "noopener"
        );
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
});
