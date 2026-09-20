// The shared menu engine — see nchito-ios/INNOVATION.md §2.1.
//
// One state machine, two transports. USSD and WhatsApp differ in how text gets
// in and out, not in what a user can do, so both adapters drive this and the
// channels cannot drift apart as features are added.
//
// Everything is written to the tighter of the two budgets: a USSD screen is
// about 182 characters, and there is no scrolling, no images and no going back
// except by re-dialling. Copy that fits USSD reads fine on WhatsApp; the
// reverse is not true.

import { Db, Session } from "./db.ts";
import { categoriesIn, SERVICE_GROUPS } from "./catalog.ts";

export const USSD_SCREEN_LIMIT = 182;

export interface Reply {
  text: string;
  /** Ends a USSD session. WhatsApp just stops expecting a numbered answer. */
  done: boolean;
}

const kwacha = (n: number) => `K${Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2)}`;

/** Trims to one USSD screen on a word boundary so nothing is cut mid-word. */
export function clamp(text: string, limit = USSD_SCREEN_LIMIT): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf("\n", limit - 1);
  return text.slice(0, cut > limit * 0.6 ? cut : limit - 1).trimEnd();
}

/** Gig titles are written for a phone screen; on USSD they must be shorter still. */
const shortTitle = (title: string, max = 34) =>
  title.length <= max ? title : title.slice(0, max - 1).trimEnd() + "…";

const con = (text: string): Reply => ({ text, done: false });
const end = (text: string): Reply => ({ text, done: true });

export async function handle(
  input: string,
  session: Session,
  phone: string,
  db: Db,
): Promise<{ reply: Reply; session: Session }> {
  const choice = input.trim();
  const data = session.data;

  // Any screen: 0 goes back to the main menu, matching how every other
  // Zambian USSD service behaves.
  if (choice === "0" && session.node !== "root") {
    return { reply: con(mainMenu()), session: { node: "root", data: {} } };
  }

  const profile = await db.profile(phone);

  // --- Unregistered: the feature-phone signup path -------------------------
  if (!profile) {
    switch (session.node) {
      case "register_name":
        if (choice.length < 2) {
          return { reply: con("Name too short.\nEnter your full name:"), session };
        }
        return {
          reply: con("Which town are you in?\n(e.g. Lusaka, Kitwe, Ndola)"),
          session: { node: "register_city", data: { name: choice } },
        };

      case "register_city": {
        const ok = await db.register(phone, data.name ?? "", choice);
        return {
          reply: end(ok
            ? `Welcome to Nchito, ${(data.name ?? "").split(" ")[0]}!\nDial back to find work near you.`
            : "Sign up failed. Please try again shortly."),
          session: { node: "root", data: {} },
        };
      }

      default:
        return {
          reply: con("Welcome to Nchito 🇿🇲\nFind work, get paid to mobile money.\n\nEnter your full name to join:"),
          session: { node: "register_name", data: {} },
        };
    }
  }

  // --- Registered ----------------------------------------------------------
  switch (session.node) {
    case "root":
      return routeMain(choice, session);

    case "gig_group": {
      // "9" is the escape hatch for someone who just wants to see whatever is
      // going, which after adding 39 categories is most people.
      if (choice === "9") {
        return browse(null, "gigs");
      }
      const group = SERVICE_GROUPS[Number(choice) - 1];
      if (!group) {
        return { reply: con("Invalid choice.\n\n" + groupMenu()), session };
      }
      return {
        reply: con(categoryMenu(group.code)),
        session: { node: "gig_category", data: { group: group.code } },
      };
    }

    case "gig_category": {
      const options = categoriesIn(data.group ?? "");
      const index = Number(choice) - 1;
      const category = options[index];
      if (!category) {
        return { reply: con("Invalid choice.\n\n" + categoryMenu(data.group ?? "")), session };
      }
      return browse(category.code, category.label.toLowerCase());
    }

    case "gig_pick": {
      const ids = (data.ids ?? "").split(",").filter(Boolean);
      const gigId = ids[Number(choice) - 1];
      if (!gigId) {
        return { reply: con("Invalid choice.\nReply with the gig number, or 0 for menu."), session };
      }
      const result = await db.apply(phone, gigId);
      return { reply: end(result), session: { node: "root", data: {} } };
    }

    case "wallet": {
      if (choice !== "1") {
        return { reply: con("Invalid choice.\n\n" + mainMenu()), session: { node: "root", data: {} } };
      }
      const balance = await db.balance(phone) ?? 0;
      if (balance <= 0) {
        return {
          reply: end("You have no money to cash out yet.\nComplete a gig or a quick task to earn."),
          session: { node: "root", data: {} },
        };
      }
      return {
        reply: con(`Balance: ${kwacha(balance)}\n\nHow much do you want to cash out?\nEnter amount in kwacha:`),
        session: { node: "cashout_amount", data: {} },
      };
    }

    case "cashout_amount": {
      const amount = Number(choice);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { reply: con("Enter a valid amount in kwacha:"), session };
      }
      return {
        reply: con(`Cashing out ${kwacha(amount)}.\n\nEnter your 4-digit Nchito PIN:`),
        session: { node: "cashout_pin", data: { amount: String(amount) } },
      };
    }

    case "advance_pick": {
      const ids = (data.ids ?? "").split(",").filter(Boolean);
      const caps = (data.caps ?? "").split(",").filter(Boolean);
      const index = Number(choice) - 1;
      if (!ids[index]) {
        return { reply: con("Invalid choice.\nReply with the number, or 0 for menu."), session };
      }
      return {
        reply: con(`Up to ${kwacha(Number(caps[index]))} available.\n\nHow much do you want now?\nEnter amount in kwacha:`),
        session: {
          node: "advance_amount",
          data: { gigId: ids[index], cap: caps[index] },
        },
      };
    }

    case "advance_amount": {
      const amount = Number(choice);
      const cap = Number(data.cap ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { reply: con("Enter a valid amount in kwacha:"), session };
      }
      if (amount > cap) {
        return { reply: con(`Most you can take is ${kwacha(cap)}.\nEnter a smaller amount:`), session };
      }
      // The fee is quoted here, before the PIN, so nobody agrees to a number
      // they have not seen.
      const fee = Math.max(Math.round(amount * 0.04 * 100) / 100, 5);
      return {
        reply: con(clamp(
          `Take ${kwacha(amount)} now.\nFee ${kwacha(fee)}. ${kwacha(amount + fee)} comes off when the gig settles.\n\nEnter your 4-digit PIN:`)),
        session: { node: "advance_pin", data: { ...data, amount: String(amount) } },
      };
    }

    case "advance_pin": {
      // Taking an advance moves money, so the PIN is checked in the database,
      // which also counts failed attempts and applies the lock-out.
      const result = await db.takeAdvance(
        phone, data.gigId ?? "", Number(data.amount ?? 0), choice);
      return { reply: end(result), session: { node: "root", data: {} } };
    }

    case "cashout_pin": {
      // The PIN is checked in the database, which also counts failed attempts
      // and applies the lock-out — closing the session cannot reset either.
      const result = await db.cashOut(phone, Number(data.amount ?? 0), choice);
      return { reply: end(result), session: { node: "root", data: {} } };
    }

    default:
      return { reply: con(mainMenu()), session: { node: "root", data: {} } };
  }

  // --- Browsing ------------------------------------------------------------

  /**
   * Lists open gigs and arms the apply step. Shared by the category path and
   * by "anything near me", so the two cannot drift in what a number means.
   */
  async function browse(
    category: string | null,
    what: string,
  ): Promise<{ reply: Reply; session: Session }> {
    const gigs = await db.browseGigs(phone, category);
    if (gigs.length === 0) {
      return {
        reply: end(clamp(`No open ${what} near you right now.\nDial back later — new gigs are posted daily.`)),
        session: { node: "root", data: {} },
      };
    }
    const screen = gigList(gigs);
    // Only the gigs that fit are selectable — otherwise "3" could apply to a
    // gig that never appeared on screen.
    const shownCount = Number(screen.match(/Reply 1-(\d+)/)?.[1] ?? gigs.length);
    return {
      reply: con(screen),
      session: {
        node: "gig_pick",
        data: { ids: gigs.slice(0, shownCount).map((g) => g.id).join(",") },
      },
    };
  }

  // --- Main menu routing ---------------------------------------------------

  async function routeMain(c: string, s: Session): Promise<{ reply: Reply; session: Session }> {
    switch (c) {
      case "1":
        return { reply: con(groupMenu()), session: { node: "gig_group", data: {} } };

      case "2": {
        const balance = await db.balance(phone) ?? 0;
        return {
          reply: con(`Nchito wallet\nBalance: ${kwacha(balance)}\n\n1. Cash out to mobile money\n0. Main menu`),
          session: { node: "wallet", data: {} },
        };
      }

      case "3": {
        const tasks = await db.openTasks();
        if (tasks.length === 0) {
          return { reply: end("No quick tasks available right now. Try again later."), session: { node: "root", data: {} } };
        }
        const lines = tasks.map((t) => `${kwacha(t.reward_zmw)} - ${shortTitle(t.title, 30)} (${t.minutes}min)`);
        return {
          reply: end(clamp("Quick tasks paying now:\n" + lines.join("\n") +
            "\n\nOpen the Nchito app to do these.")),
          session: { node: "root", data: {} },
        };
      }

      case "4": {
        const record = await db.workRecord(phone);
        if (!record || record.total_gigs === 0) {
          return {
            reply: end("No completed jobs yet.\nEvery gig you finish through Nchito is added to your work record."),
            session: { node: "root", data: {} },
          };
        }
        const onTime = record.on_time_rate === null ? "-" : `${record.on_time_rate}%`;
        const rating = record.average_rating === null ? "-" : `${record.average_rating}`;
        return {
          reply: end(clamp(
            `Your Nchito work record\n` +
            `${record.total_gigs} jobs done\n` +
            `${kwacha(record.total_earned)} earned\n` +
            `${onTime} on time | ${rating} rating\n\n` +
            `Open the app to share it or save it as a CV.`)),
          session: { node: "root", data: {} },
        };
      }

      case "5": {
        // Earned wage access (INNOVATION.md §3.2). This is the channel where it
        // matters most: someone on a feature phone needing cash today is exactly
        // who would otherwise take a cash job instead.
        const offers = await db.advanceOffers(phone);
        if (offers.length === 0) {
          return {
            reply: end(clamp(
              "No early payment available.\nYou need a gig in progress with your 'before' photo taken, " +
              "and 3 completed jobs.")),
            session: { node: "root", data: {} },
          };
        }
        const lines = offers.map((o, i) =>
          `${i + 1}. up to ${kwacha(o.max_amount)} - ${shortTitle(o.title, 26)}`);
        return {
          reply: con(clamp("Get paid early:\n" + lines.join("\n") + "\nReply with a number. 0=menu")),
          session: {
            node: "advance_pick",
            data: {
              ids: offers.map((o) => o.gig_id).join(","),
              caps: offers.map((o) => String(o.max_amount)).join(","),
            },
          },
        };
      }

      case "6": {
        // Agent liquidity (INNOVATION.md §3.1). Someone on a feature phone who
        // cannot convert their balance is exactly who this exists for.
        const agents = await db.nearbyAgents(phone);
        if (agents.length === 0) {
          return {
            reply: end("No agents reported near you yet.\nReport one in the Nchito app to help others."),
            session: { node: "root", data: {} },
          };
        }
        // Freshness is the whole story with float, so it is never dropped for
        // space — the agent name is shortened instead. Built up line by line so
        // a clamp can't silently eat the last entry, the way it once ate the
        // gig list's instruction.
        const header = "Cash near you:";
        const footer = "\nFrom other workers.";
        const shown: string[] = [];
        for (const a of agents) {
          const age = a.last_report_at ? `, ${freshness(a.last_report_at)}` : "";
          const line = `${shortTitle(a.name, 17)} ${a.distance_km}km\n ${statusWord(a.status)}${age}`;
          if ([header, ...shown, line].join("\n").length + footer.length > USSD_SCREEN_LIMIT) break;
          shown.push(line);
        }
        return {
          reply: end([header, ...shown].join("\n") + footer),
          session: { node: "root", data: {} },
        };
      }

      default:
        return { reply: con(mainMenu()), session: { node: "root", data: {} } };
    }
  }
}

/** Plain words, because "unknown" must not read as "probably fine". */
function statusWord(status: string): string {
  switch (status) {
    case "has_cash": return "had cash";
    case "no_cash": return "NO cash";
    case "mixed": return "mixed";
    default: return "not reported yet";
  }
}

function freshness(isoDate: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return "over a day";
}

// --- Screens ---------------------------------------------------------------

export function mainMenu(): string {
  return "Nchito 🇿🇲\n1. Find gigs\n2. My wallet\n3. Quick tasks\n4. My work record\n5. Get paid early\n6. Find cash near me";
}

/**
 * Eight families, not thirty-nine categories.
 *
 * A USSD screen is 182 characters with no scrolling, so a flat list of every
 * service would take six screens that a user cannot page through. Grouping
 * costs one extra keypress and makes the whole catalogue reachable — and "9"
 * skips the taxonomy entirely for the many people who just want to see what
 * is going.
 */
function groupMenu(): string {
  const header = "What kind of work?";
  const footer = "\n9. Anything near me\n0. Back";
  const lines: string[] = [];
  for (const [i, g] of SERVICE_GROUPS.entries()) {
    const line = `${i + 1}. ${g.short}`;
    if ([header, ...lines, line].join("\n").length + footer.length > USSD_SCREEN_LIMIT) break;
    lines.push(line);
  }
  return [header, ...lines].join("\n") + footer;
}

/** The services inside one family, using the short labels sized for USSD. */
function categoryMenu(group: string): string {
  const options = categoriesIn(group);
  const header = `${SERVICE_GROUPS.find((g) => g.code === group)?.label ?? "Work"}:`;
  const footer = "\n0. Back";
  const lines: string[] = [];
  for (const [i, c] of options.entries()) {
    const line = `${i + 1}. ${c.short}`;
    if ([header, ...lines, line].join("\n").length + footer.length > USSD_SCREEN_LIMIT) break;
    lines.push(line);
  }
  return [header, ...lines].join("\n") + footer;
}

/**
 * Fits as many gigs as the screen allows, dropping the overflow rather than
 * letting a clamp eat the footer. Losing "reply with a number" strands the
 * user: USSD has no buttons, no scroll and nothing else to infer from.
 */
function gigList(gigs: Array<{ title: string; pay_zmw: number; area: string; is_urgent: boolean }>): string {
  const header = "Gigs near you:";

  const shown: string[] = [];
  for (const [i, g] of gigs.entries()) {
    const line = `${i + 1}. ${kwacha(g.pay_zmw)} ${shortTitle(g.title, 30)}` +
                 `${g.is_urgent ? " !" : ""} - ${g.area}`;
    // Footer length depends on how many gigs we end up showing, so recompute
    // it against this candidate count before accepting the line.
    const footer = `\nReply 1-${shown.length + 1} to apply. 0=menu`;
    const candidate = [header, ...shown, line].join("\n") + footer;
    if (candidate.length > USSD_SCREEN_LIMIT) break;
    shown.push(line);
  }

  // Nothing fit, which means a single title is pathologically long; show one
  // hard-truncated entry rather than an empty list.
  if (shown.length === 0 && gigs.length > 0) {
    shown.push(`1. ${kwacha(gigs[0].pay_zmw)} ${shortTitle(gigs[0].title, 20)}`);
  }

  return [header, ...shown].join("\n") + `\nReply 1-${shown.length} to apply. 0=menu`;
}
