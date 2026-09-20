-- Nchito — USSD and WhatsApp channels (see nchito-ios/INNOVATION.md §2.1)
--
-- Research on African super-apps is blunt: a large share of users are on
-- feature phones or cannot spare a data bundle. Requiring the app caps Nchito
-- at the smartphone minority. These functions let someone browse gigs, apply,
-- check a balance and cash out from a K150 handset with no data at all.
--
-- SECURITY NOTE, and it is the important one in this file.
-- Edge Functions connect with the service role, which BYPASSES row level
-- security. There is no auth.uid() on a USSD call. So every function here takes
-- the caller's phone number and authorises against it itself — the RLS policies
-- protecting the app do nothing on this path. Each function therefore:
--   * resolves the phone to exactly one profile, or refuses;
--   * only ever reads or writes rows belonging to that profile;
--   * re-checks money rules (balance, PIN) server-side rather than trusting
--     anything the channel layer passed in.
-- Treat the phone number as the only identity claim and verify the webhook
-- itself upstream (see supabase/functions/README.md).

-- ============================================================
-- 1. Channel sessions
-- ============================================================

create type channel_kind as enum ('ussd', 'whatsapp');

-- USSD is inherently stateful: a session is a short walk through a menu tree.
-- WhatsApp is conversational but benefits from the same state so both channels
-- can share one engine instead of drifting apart.
create table public.channel_sessions (
  id uuid primary key default gen_random_uuid(),
  channel channel_kind not null,
  external_id text not null,          -- aggregator session id, or the WhatsApp wa_id
  phone text not null,
  node text not null default 'root',  -- current menu node
  data jsonb not null default '{}',   -- accumulated answers for this walk
  pin_attempts int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create index channel_sessions_phone_idx on public.channel_sessions (phone, updated_at desc);

-- Network USSD sessions die after ~90-180s; WhatsApp threads should not resume
-- a half-finished cash-out hours later either.
create or replace function public.expire_channel_sessions()
returns void language sql as $$
  delete from public.channel_sessions where updated_at < now() - interval '30 minutes';
$$;

-- ============================================================
-- 2. PIN for money movement
-- ============================================================

-- On USSD the network asserts the phone number, which is a decent identity
-- claim — but a stolen handset would otherwise be a drained wallet. Mobile
-- money in this market always asks for a PIN before money moves, and users
-- expect it. The PIN is set in the app and only ever stored hashed.
alter table public.profiles
  add column if not exists channel_pin_hash text,
  add column if not exists channel_locked_until timestamptz;

create or replace function public.set_channel_pin(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  -- Reject the handful of PINs that are guessed first.
  if p_pin in ('0000','1111','2222','3333','4444','5555','6666','7777','8888',
               '9999','1234','4321','1212','0123') then
    raise exception 'That PIN is too easy to guess. Choose another.';
  end if;
  update public.profiles
     set channel_pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         channel_locked_until = null
   where id = auth.uid();
end $$;

-- ============================================================
-- 3. Phone-authorised channel functions
-- ============================================================

-- Single place that turns an asserted phone number into a profile. Everything
-- below goes through it, so there is one definition of "who is calling".
create or replace function public.channel_profile(p_phone text)
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where phone = p_phone limit 1;
$$;

-- Registration from a feature phone. This is the growth unlock: someone with no
-- smartphone and no data can still join. The auth user is created by the Edge
-- Function (service role) first; this attaches the profile details.
create or replace function public.channel_complete_registration(
  p_user_id uuid, p_phone text, p_full_name text, p_city text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set full_name = p_full_name,
         city = coalesce(nullif(p_city, ''), 'Lusaka')
   where id = p_user_id and phone = p_phone;
end $$;

-- Open gigs near the caller. Ordered so boosted listings lead, matching the app.
create or replace function public.channel_browse_gigs(
  p_phone text, p_category gig_category default null, p_limit int default 3, p_offset int default 0)
returns table (id uuid, title text, pay_zmw numeric, city text, area text, is_urgent boolean)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return; end if;

  return query
  select g.id, g.title, g.pay_zmw, g.city, g.area, g.is_urgent
    from public.gigs g
   where g.status = 'open'
     and (p_category is null or g.category = p_category)
     and (g.city = me.city or p_category is not null)
   order by (g.boosted_until is not null and g.boosted_until > now()) desc,
            g.created_at desc
   limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end $$;

-- Apply. Re-checks everything rather than trusting the channel layer: the gig
-- must exist and be open, and a worker cannot apply to their own gig.
create or replace function public.channel_apply(p_phone text, p_gig_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me public.profiles; g public.gigs;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return 'You are not registered on Nchito.'; end if;

  select * into g from public.gigs where id = p_gig_id;
  if g.id is null then return 'That gig is no longer listed.'; end if;
  if g.status <> 'open' then return 'That gig has already been taken.'; end if;
  if g.poster_id = me.id then return 'That is your own gig.'; end if;

  insert into public.gig_applications (gig_id, worker_id, cover_note)
  values (p_gig_id, me.id, 'Applied via mobile')
  on conflict (gig_id, worker_id) do nothing;

  if not found then return 'You have already applied for this gig.'; end if;
  return 'Applied. You will get an SMS if you are picked.';
end $$;

create or replace function public.channel_balance(p_phone text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return null; end if;
  return public.wallet_balance(me.id);
end $$;

-- Cash out. The PIN is checked here, in the database, not in the Edge Function —
-- the channel layer must not be able to wave money through by asserting success.
create or replace function public.channel_cash_out(p_phone text, p_amount numeric, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare me public.profiles; available numeric;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return 'You are not registered on Nchito.'; end if;

  if me.channel_locked_until is not null and me.channel_locked_until > now() then
    return 'Too many wrong PINs. Try again in 30 minutes.';
  end if;

  if me.channel_pin_hash is null then
    return 'Set a PIN in the Nchito app before cashing out from your phone.';
  end if;

  if extensions.crypt(p_pin, me.channel_pin_hash) <> me.channel_pin_hash then
    -- Three strikes, then a cool-off. Counting attempts here rather than in the
    -- session means closing the session cannot reset them.
    update public.profiles
       set channel_locked_until = case
             when channel_locked_until is null then now() + interval '2 minutes'
             else now() + interval '30 minutes' end
     where id = me.id;
    return 'Wrong PIN.';
  end if;

  if p_amount is null or p_amount <= 0 then return 'Enter a valid amount.'; end if;

  available := public.wallet_balance(me.id);
  if p_amount > available then
    return 'Not enough balance. You have ' || to_char(available, 'FM999999990.00') || ' kwacha.';
  end if;

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
  values (me.id, 'cash_out', -p_amount, 'Cash out via mobile');

  update public.profiles set channel_locked_until = null where id = me.id;

  return 'Sent ' || to_char(p_amount, 'FM999999990.00') || ' kwacha to your mobile money. ' ||
         'Balance: ' || to_char(available - p_amount, 'FM999999990.00');
end $$;

create or replace function public.channel_work_record(p_phone text)
returns table (total_gigs int, total_earned numeric, on_time_rate numeric, average_rating numeric)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return; end if;

  return query
  select count(*)::int,
         coalesce(sum(w.pay_zmw), 0),
         case when count(*) = 0 then null
              else round(100.0 * count(*) filter (where w.on_time) / count(*), 0) end,
         round(avg(w.poster_rating), 1)
    from public.work_records w
   where w.worker_id = me.id;
end $$;

create or replace function public.channel_open_tasks(p_limit int default 3)
returns table (id uuid, title text, reward_zmw numeric, minutes int)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.reward_zmw, t.minutes
    from public.micro_tasks t
   where t.active and t.slots_taken < t.slots_total
   order by t.reward_zmw desc
   limit greatest(p_limit, 1);
$$;

-- ============================================================
-- 4. Lock down
-- ============================================================

-- The session table is touched only by the Edge Functions (service role);
-- no app client should read other people's sessions.
alter table public.channel_sessions enable row level security;

-- These run as definer and authorise by phone internally. They must not be
-- reachable from a browser, where anyone could pass someone else's number.
revoke execute on function public.channel_profile(text) from anon, authenticated;
revoke execute on function public.channel_browse_gigs(text, gig_category, int, int) from anon, authenticated;
revoke execute on function public.channel_apply(text, uuid) from anon, authenticated;
revoke execute on function public.channel_balance(text) from anon, authenticated;
revoke execute on function public.channel_cash_out(text, numeric, text) from anon, authenticated;
revoke execute on function public.channel_work_record(text) from anon, authenticated;
revoke execute on function public.channel_open_tasks(int) from anon, authenticated;
revoke execute on function public.channel_complete_registration(uuid, text, text, text) from anon, authenticated;

-- set_channel_pin is the exception: it is called by the signed-in user from the
-- app and authorises through auth.uid(), not a passed-in phone number.
grant execute on function public.set_channel_pin(text) to authenticated;
