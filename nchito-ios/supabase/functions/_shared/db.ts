// Data access for the USSD and WhatsApp channels.
//
// Every call goes through the channel_* RPCs in 0004_offline_channels.sql,
// which authorise by phone number themselves. That matters: this client uses
// the service role key, so row level security does NOT apply here. Never query
// tables directly from the channel layer — always go through an RPC that
// re-checks who is asking.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface Gig {
  id: string;
  title: string;
  pay_zmw: number;
  city: string;
  area: string;
  is_urgent: boolean;
}

export interface MicroTask {
  id: string;
  title: string;
  reward_zmw: number;
  minutes: number;
}

export interface Profile {
  id: string;
  phone: string;
  full_name: string;
  city: string;
}

export interface AdvanceOffer {
  gig_id: string;
  title: string;
  max_amount: number;
}

export interface WorkRecordTotals {
  total_gigs: number;
  total_earned: number;
  on_time_rate: number | null;
  average_rating: number | null;
}

export type Channel = "ussd" | "whatsapp";

export interface Session {
  node: string;
  data: Record<string, string>;
}

export class Db {
  private client: SupabaseClient;

  constructor() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  // --- Identity -------------------------------------------------------------

  async profile(phone: string): Promise<Profile | null> {
    const { data } = await this.client.rpc("channel_profile", { p_phone: phone });
    // The RPC returns a composite row; an unregistered number yields a null id.
    const row = Array.isArray(data) ? data[0] : data;
    return row?.id ? row as Profile : null;
  }

  /**
   * Creates the auth user for a feature-phone signup, then fills in the profile.
   * The signup trigger from 0001 creates the profile row; this adds the details.
   */
  async register(phone: string, fullName: string, city: string): Promise<boolean> {
    const { data, error } = await this.client.auth.admin.createUser({
      phone,
      phone_confirm: true,   // the network already proved they hold this number
    });
    if (error || !data.user) return false;

    const { error: profileError } = await this.client.rpc("channel_complete_registration", {
      p_user_id: data.user.id,
      p_phone: phone,
      p_full_name: fullName,
      p_city: city,
    });
    return !profileError;
  }

  // --- Gigs -----------------------------------------------------------------

  async browseGigs(phone: string, category: string | null, limit = 3, offset = 0): Promise<Gig[]> {
    const { data } = await this.client.rpc("channel_browse_gigs", {
      p_phone: phone, p_category: category, p_limit: limit, p_offset: offset,
    });
    return (data ?? []) as Gig[];
  }

  async apply(phone: string, gigId: string): Promise<string> {
    const { data, error } = await this.client.rpc("channel_apply", {
      p_phone: phone, p_gig_id: gigId,
    });
    if (error) return "Something went wrong. Please try again.";
    return data as string;
  }

  // --- Wallet ---------------------------------------------------------------

  async balance(phone: string): Promise<number | null> {
    const { data } = await this.client.rpc("channel_balance", { p_phone: phone });
    return data === null ? null : Number(data);
  }

  /** The PIN is verified inside the database, never here. */
  async cashOut(phone: string, amount: number, pin: string): Promise<string> {
    const { data, error } = await this.client.rpc("channel_cash_out", {
      p_phone: phone, p_amount: amount, p_pin: pin,
    });
    if (error) return "Cash out failed. Please try again.";
    return data as string;
  }

  // --- Other ----------------------------------------------------------------

  // --- Earned wage access ---------------------------------------------------

  /** Gigs the caller could take an advance on right now, with each cap. */
  async advanceOffers(phone: string): Promise<AdvanceOffer[]> {
    const { data } = await this.client.rpc("channel_advance_offer", { p_phone: phone });
    return (data ?? []) as AdvanceOffer[];
  }

  /** The PIN is verified inside the database, never here. */
  async takeAdvance(phone: string, gigId: string, amount: number, pin: string): Promise<string> {
    const { data, error } = await this.client.rpc("channel_take_advance", {
      p_phone: phone, p_gig_id: gigId, p_amount: amount, p_pin: pin,
    });
    if (error) return "Early payment failed. Please try again.";
    return data as string;
  }

  async openTasks(limit = 3): Promise<MicroTask[]> {
    const { data } = await this.client.rpc("channel_open_tasks", { p_limit: limit });
    return (data ?? []) as MicroTask[];
  }

  async workRecord(phone: string): Promise<WorkRecordTotals | null> {
    const { data } = await this.client.rpc("channel_work_record", { p_phone: phone });
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  }

  // --- Sessions -------------------------------------------------------------

  async loadSession(channel: Channel, externalId: string): Promise<Session> {
    const { data } = await this.client
      .from("channel_sessions")
      .select("node, data, updated_at")
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();

    // A stale session is treated as no session, so an abandoned cash-out can
    // never be resumed hours later from a different context.
    if (!data) return { node: "root", data: {} };
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > 30 * 60 * 1000) return { node: "root", data: {} };

    return { node: data.node, data: (data.data ?? {}) as Record<string, string> };
  }

  async saveSession(channel: Channel, externalId: string, phone: string, session: Session) {
    await this.client.from("channel_sessions").upsert({
      channel,
      external_id: externalId,
      phone,
      node: session.node,
      data: session.data,
      updated_at: new Date().toISOString(),
    }, { onConflict: "channel,external_id" });
  }

  async clearSession(channel: Channel, externalId: string) {
    await this.client.from("channel_sessions")
      .delete().eq("channel", channel).eq("external_id", externalId);
  }
}
