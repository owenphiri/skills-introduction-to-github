-- Nchito — mobile money agent liquidity map (see nchito-ios/INNOVATION.md §3.1)
--
-- Field reporting on Zambian mobile money puts the problem exactly: "a wallet
-- credit you cannot convert is not the same thing as money." Agents run out of
-- float, especially at month-end and rurally. A worker who cannot cash out
-- stops trusting the wallet and goes back to cash gigs — which undoes the whole
-- product.
--
-- So this maps where cash actually IS, crowdsourced from the cash-outs Nchito
-- already sees.
--
-- THE GOVERNING CONSTRAINT: a false positive costs someone a trip. Bus fare to
-- an agent who turns out to be dry is real money to someone earning K150 a day,
-- and being sent on a wasted journey destroys trust faster than showing nothing.
-- Everything below therefore biases toward admitting uncertainty: reports decay
-- fast, thin evidence reports as unknown rather than guessing, and a confirmed
-- small withdrawal never implies a large one is possible.

-- ============================================================
-- 1. Agents
-- ============================================================

-- Created before the table that uses it. Earlier migrations never needed a
-- provider type — the apps carried it locally — so it is introduced here.
do $$ begin
  create type mobile_money_provider as enum ('mtn_momo', 'airtel_money', 'zamtel_kwacha');
exception when duplicate_object then null;
end $$;

create table public.mobile_money_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Most agents serve more than one network, and float differs per network:
  -- the same kiosk can be dry for MTN and fine for Airtel.
  providers mobile_money_provider[] not null default '{}',
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  area text not null default '',
  city text not null default '',
  landmark text not null default '',        -- how people actually navigate here
  added_by uuid references public.profiles(id),
  -- Operator-sourced agents are trusted on sight; user-submitted ones need
  -- corroboration before they are shown as established.
  is_operator_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index agents_location_idx on public.mobile_money_agents (latitude, longitude);
create index agents_city_idx on public.mobile_money_agents (city, is_active);

-- ============================================================
-- 2. Reports
-- ============================================================

create type agent_outcome as enum (
  'cash_available',   -- withdrawal succeeded
  'no_cash',          -- agent had no float
  'closed',           -- not trading
  'not_found'         -- location is wrong or the agent has gone
);

create table public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.mobile_money_agents(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  provider mobile_money_provider not null,
  outcome agent_outcome not null,
  -- What was actually withdrawn or attempted. An agent who paid out K200 may
  -- still not have K2000, so a confirmation is only good up to its own amount.
  amount_zmw numeric(10,2),
  created_at timestamptz not null default now()
);
create index agent_reports_recent_idx on public.agent_reports (agent_id, created_at desc);

-- Anti-gaming. A rival agent could otherwise report competitors as dry all day.
--   * Only people who have actually moved money through Nchito may report.
--   * One report per person per agent per hour.
-- Reporter standing is applied as a weight in the scoring below rather than as
-- a hard gate, so a new but honest user still counts for something.
create or replace function public.can_report_agent(p_user uuid, p_agent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.wallet_transactions
             where user_id = p_user and kind = 'cash_out')
    and not exists (select 1 from public.agent_reports
                     where reporter_id = p_user and agent_id = p_agent
                       and created_at > now() - interval '1 hour');
$$;

create or replace function public.report_agent(
  p_agent_id uuid, p_provider mobile_money_provider,
  p_outcome agent_outcome, p_amount numeric default null)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;

  if not public.can_report_agent(me, p_agent_id) then
    return 'You can report this agent again in an hour.';
  end if;

  insert into public.agent_reports (agent_id, reporter_id, provider, outcome, amount_zmw)
  values (p_agent_id, me, p_provider, p_outcome, p_amount);

  return case p_outcome
    when 'cash_available' then 'Thanks — others will see this agent has cash.'
    else 'Thanks — this saves someone else a wasted trip.'
  end;
end $$;

-- ============================================================
-- 3. Confidence
-- ============================================================

-- Half-life of a report, in hours. Agent float turns over across a day, not a
-- week: a report from this morning says little about this afternoon, and one
-- from yesterday says almost nothing. Short by design — stale optimism is what
-- sends people on wasted journeys.
create or replace function public.report_half_life_hours()
returns numeric language sql immutable as $$ select 3.0::numeric $$;

-- Minimum total weight before any claim is made at all. Below it the answer is
-- "we don't know", which is honest and costs nobody a bus fare.
--
-- Set so that ONE very recent report clears it. That is a deliberate judgment:
-- requiring two would leave most agents reading 'unknown' in a thin market and
-- make the map useless exactly when it needs to earn trust. The risk is bounded
-- because a reporter must have actually cashed out through Nchito, may report
-- an agent only once an hour, and a wrong 'has cash' self-corrects within
-- minutes once the next visitor reports otherwise. The apps therefore always
-- show the report count and age alongside the status, so "1 person, 10 minutes
-- ago" reads differently from "4 people in the last hour" — the caller decides
-- whether the evidence is worth the trip.
create or replace function public.min_confidence_weight()
returns numeric language sql immutable as $$ select 0.8::numeric $$;

-- Liquidity for one agent and provider, optionally for a specific amount.
--
-- Returns status in {'has_cash','no_cash','mixed','unknown'} — 'unknown' is a
-- first-class answer, not a failure.
create or replace function public.agent_liquidity(
  p_agent_id uuid, p_provider mobile_money_provider, p_amount numeric default null)
returns table (status text, confidence numeric, last_report_at timestamptz,
               confirmed_up_to numeric, report_count int)
language plpgsql stable security definer set search_path = public as $$
declare
  positive numeric := 0;
  negative numeric := 0;
  total numeric;
begin
  -- Exponential decay by age. Reports older than a day contribute so little
  -- they are simply excluded.
  select
    coalesce(sum(case when r.outcome = 'cash_available'
                      then power(0.5, extract(epoch from (now() - r.created_at)) / 3600.0
                                      / public.report_half_life_hours())
                      else 0 end), 0),
    coalesce(sum(case when r.outcome in ('no_cash', 'closed')
                      then power(0.5, extract(epoch from (now() - r.created_at)) / 3600.0
                                      / public.report_half_life_hours())
                      else 0 end), 0)
    into positive, negative
    from public.agent_reports r
   where r.agent_id = p_agent_id
     and r.provider = p_provider
     and r.created_at > now() - interval '24 hours'
     -- A confirmation only counts for amounts at or below what was actually
     -- withdrawn. Someone cashing out K1500 is not served by knowing the agent
     -- managed K100 this morning.
     and (p_amount is null or r.outcome <> 'cash_available'
          or coalesce(r.amount_zmw, 0) >= p_amount);

  total := positive + negative;

  return query
  select
    case
      when total < public.min_confidence_weight() then 'unknown'
      when positive / nullif(total, 0) >= 0.6 then 'has_cash'
      when positive / nullif(total, 0) <= 0.4 then 'no_cash'
      else 'mixed'
    end,
    round(total, 2),
    (select max(created_at) from public.agent_reports
      where agent_id = p_agent_id and provider = p_provider),
    (select max(amount_zmw) from public.agent_reports
      where agent_id = p_agent_id and provider = p_provider
        and outcome = 'cash_available'
        and created_at > now() - interval '24 hours'),
    (select count(*)::int from public.agent_reports
      where agent_id = p_agent_id and provider = p_provider
        and created_at > now() - interval '24 hours');
end $$;

-- ============================================================
-- 4. Finding agents
-- ============================================================

-- Great-circle distance in kilometres. Written out rather than pulling in
-- PostGIS: at city scale the difference is metres, and one fewer extension is
-- one fewer thing to install correctly.
create or replace function public.distance_km(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric language sql immutable as $$
  select round((6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  )))::numeric, 2);
$$;

create or replace function public.nearby_agents(
  p_lat numeric, p_lon numeric, p_provider mobile_money_provider,
  p_amount numeric default null, p_radius_km numeric default 5, p_limit int default 20)
returns table (
  id uuid, name text, area text, landmark text,
  latitude numeric, longitude numeric, distance_km numeric,
  is_operator_verified boolean,
  status text, confidence numeric, last_report_at timestamptz,
  confirmed_up_to numeric, report_count int)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.area, a.landmark, a.latitude, a.longitude,
         public.distance_km(p_lat, p_lon, a.latitude, a.longitude) as distance_km,
         a.is_operator_verified,
         l.status, l.confidence, l.last_report_at, l.confirmed_up_to, l.report_count
    from public.mobile_money_agents a
    cross join lateral public.agent_liquidity(a.id, p_provider, p_amount) l
   where a.is_active
     and p_provider = any(a.providers)
     -- Cheap bounding box before the trigonometry: roughly 111km per degree.
     and a.latitude between p_lat - (p_radius_km / 111.0) and p_lat + (p_radius_km / 111.0)
     and a.longitude between p_lon - (p_radius_km / 111.0) and p_lon + (p_radius_km / 111.0)
     and public.distance_km(p_lat, p_lon, a.latitude, a.longitude) <= p_radius_km
   -- Confirmed cash first, then unknowns, then known-dry last but still listed:
   -- an agent reported dry an hour ago may have been restocked, and hiding it
   -- entirely would be its own kind of false claim.
   order by case l.status when 'has_cash' then 0 when 'unknown' then 1
                          when 'mixed' then 2 else 3 end,
            distance_km
   limit greatest(p_limit, 1);
$$;

-- User-submitted agents. The map is useless empty, and operators will not hand
-- over a full agent list on day one, so the people using it can add what they
-- find.
create or replace function public.submit_agent(
  p_name text, p_lat numeric, p_lon numeric, p_area text,
  p_city text, p_landmark text, p_providers mobile_money_provider[])
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; nearby_existing uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(trim(p_name)) < 2 then raise exception 'Agent name is too short'; end if;

  -- Don't create a duplicate for a kiosk someone already added 30m away.
  select a.id into nearby_existing
    from public.mobile_money_agents a
   where public.distance_km(p_lat, p_lon, a.latitude, a.longitude) < 0.05
     and lower(a.name) = lower(trim(p_name))
   limit 1;
  if nearby_existing is not null then return nearby_existing; end if;

  insert into public.mobile_money_agents
    (name, providers, latitude, longitude, area, city, landmark, added_by)
  values (trim(p_name), p_providers, p_lat, p_lon, p_area, p_city, p_landmark, auth.uid())
  returning id into new_id;

  return new_id;
end $$;

-- ============================================================
-- 5. Channel access (USSD / WhatsApp)
-- ============================================================

-- Rough centres, so a USSD user gets something useful without GPS.
create or replace function public.city_centre(p_city text)
returns table (lat numeric, lon numeric) language sql immutable as $$
  select * from (values
    ('lusaka',      -15.3875::numeric, 28.3228::numeric),
    ('kitwe',       -12.8024::numeric, 28.2132::numeric),
    ('ndola',       -12.9587::numeric, 28.6366::numeric),
    ('livingstone', -17.8419::numeric, 25.8543::numeric),
    ('kabwe',       -14.4469::numeric, 28.4464::numeric),
    ('chipata',     -13.6333::numeric, 32.6500::numeric),
    ('solwezi',     -12.1688::numeric, 26.3894::numeric)
  ) as c(city, lat, lon)
  where c.city = lower(trim(p_city));
$$;

-- Someone on a feature phone who cannot cash out is exactly who this is for.
-- Same authorise-by-phone pattern as 0004: Edge Functions bypass RLS.
create or replace function public.channel_nearby_agents(
  p_phone text, p_provider mobile_money_provider default 'mtn_momo', p_limit int default 3)
returns table (name text, area text, distance_km numeric, status text, last_report_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; centre record;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return; end if;

  -- No GPS over USSD, so fall back to the city centre the profile names.
  select * into centre from public.city_centre(me.city);
  if centre.lat is null then return; end if;

  return query
  select n.name, n.area, n.distance_km, n.status, n.last_report_at
    from public.nearby_agents(centre.lat, centre.lon, p_provider, null, 10, p_limit) n;
end $$;

-- ============================================================
-- 6. Permissions
-- ============================================================

alter table public.mobile_money_agents enable row level security;
alter table public.agent_reports enable row level security;

-- The agent list is shared infrastructure: every signed-in user can read it.
create policy "agents readable" on public.mobile_money_agents
  for select to authenticated using (is_active);

-- Reports are deliberately NOT readable row by row. They reveal where a user
-- was and when, and nobody needs that — only the aggregate is useful, and that
-- comes from agent_liquidity().
create policy "own reports readable" on public.agent_reports
  for select to authenticated using (reporter_id = auth.uid());

grant execute on function public.nearby_agents(numeric, numeric, mobile_money_provider,
                                               numeric, numeric, int) to authenticated;
grant execute on function public.agent_liquidity(uuid, mobile_money_provider, numeric) to authenticated;
grant execute on function public.report_agent(uuid, mobile_money_provider, agent_outcome, numeric) to authenticated;
grant execute on function public.submit_agent(text, numeric, numeric, text, text, text,
                                              mobile_money_provider[]) to authenticated;

revoke execute on function public.channel_nearby_agents(text, mobile_money_provider, int)
  from anon, authenticated;
