-- Nchito 0011 — the digital Chilimba (rotating savings circle)
--
-- INNOVATION.md §3.3. A chilimba is a group who each put in a fixed amount
-- every cycle, and take turns receiving the whole pot. It is ordinary Zambian
-- financial life, and it works on trust between people who know each other.
--
-- ─────────────────────────────────────────────────────────────────────────
-- READ THIS BEFORE ENABLING IT
--
-- Pooling members' money and paying it out is plausibly a deposit-taking or
-- savings-scheme activity under Zambian financial regulation, and the Bank of
-- Zambia is the authority on whether Nchito may do it. Nothing in this file
-- constitutes a view that it may.
--
-- So the whole feature is behind `chilimba_enabled()`, which returns FALSE
-- until someone sets `app.chilimba_enabled` on the database. Every entry point
-- checks it and refuses with a message naming the reason. This is deliberate:
-- the failure mode of shipping this by accident is not a bug report, it is an
-- unlicensed financial product holding other people's money.
-- ─────────────────────────────────────────────────────────────────────────
--
-- The design choices that matter are all about the ways these go wrong:
--
--   · Order is RANDOMISED at activation, from a recorded seed. First-come
--     order means whoever started the circle always collects first, which is
--     how a savings club turns into a scheme.
--   · A round does not advance until EVERY active member has paid. Nobody
--     collects a pot that is short.
--   · Somebody who has already collected and then stops paying is the whole
--     risk in a chilimba. `chilimba_position()` makes that exposure a number
--     on the screen, and leaving while behind is refused with the amount.
--   · Joining is capped against what the member has actually earned through
--     Nchito. A circle nobody can afford is not a saving, it is a debt.

-- ============================================================
-- The gate
-- ============================================================
create or replace function public.chilimba_enabled()
returns boolean
language sql stable
as $$
  select coalesce(current_setting('app.chilimba_enabled', true), 'false') = 'true';
$$;

comment on function public.chilimba_enabled is
  'Master switch. False until Nchito holds whatever authorisation the Bank of
   Zambia requires for pooling and redistributing members'' money. Set with:
   alter database <db> set app.chilimba_enabled = ''true'';';

create or replace function public.chilimba_require_enabled()
returns void
language plpgsql stable
as $$
begin
  if not public.chilimba_enabled() then
    raise exception
      'Chilimba is switched off. It pools and redistributes members'' money, which needs financial authorisation before it may run.'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- ============================================================
-- Types and tables
-- ============================================================
create type chilimba_status  as enum ('forming', 'active', 'completed', 'cancelled');
create type chilimba_cadence as enum ('weekly', 'fortnightly', 'monthly');
create type chilimba_member_status as enum ('active', 'left', 'defaulted');

create or replace function public.cadence_days(p_cadence chilimba_cadence)
returns int
language sql immutable
as $$
  select case p_cadence
           when 'weekly' then 7
           when 'fortnightly' then 14
           else 30
         end;
$$;

create table if not exists public.chilimba_circles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(trim(name)) between 3 and 60),
  created_by      uuid not null references public.profiles(id) on delete restrict,
  contribution_zmw numeric(12,2) not null check (contribution_zmw >= 20),
  cadence         chilimba_cadence not null default 'monthly',
  -- Three is the smallest group where taking turns means anything; above about
  -- a dozen the wait for your turn stops being worth it and people drop out.
  member_target   int not null check (member_target between 3 and 12),
  status          chilimba_status not null default 'forming',
  current_round   int not null default 0,
  -- Recorded so the running order can be re-derived and checked by anyone who
  -- doubts it. A random order nobody can verify is just a claim.
  order_seed      text,
  invite_code     text unique not null,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.chilimba_members (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.chilimba_circles(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete restrict,
  position    int,
  status      chilimba_member_status not null default 'active',
  -- Off by default. Taking a slice of somebody's payout without them choosing
  -- it is not a saving feature, it is a deduction.
  auto_contribute boolean not null default false,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  unique (circle_id, member_id),
  unique (circle_id, position)
);

create table if not exists public.chilimba_contributions (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.chilimba_circles(id) on delete cascade,
  round       int not null check (round > 0),
  member_id   uuid not null references public.profiles(id) on delete restrict,
  amount_zmw  numeric(12,2) not null check (amount_zmw > 0),
  source      text not null default 'wallet' check (source in ('wallet', 'payout_split', 'manual')),
  paid_at     timestamptz not null default now(),
  unique (circle_id, round, member_id)
);

create table if not exists public.chilimba_payouts (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.chilimba_circles(id) on delete cascade,
  round        int not null check (round > 0),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  amount_zmw   numeric(12,2) not null check (amount_zmw > 0),
  paid_at      timestamptz not null default now(),
  unique (circle_id, round)
);

create index if not exists chilimba_members_member_idx on public.chilimba_members (member_id, status);
create index if not exists chilimba_contrib_round_idx on public.chilimba_contributions (circle_id, round);

-- ============================================================
-- Row level security
-- ============================================================
alter table public.chilimba_circles       enable row level security;
alter table public.chilimba_members       enable row level security;
alter table public.chilimba_contributions enable row level security;
alter table public.chilimba_payouts       enable row level security;

create or replace function public.in_circle(p_circle uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.chilimba_members m
     where m.circle_id = p_circle and m.member_id = auth.uid()
  );
$$;

drop policy if exists "members see their circle" on public.chilimba_circles;
create policy "members see their circle"
  on public.chilimba_circles for select
  using (public.in_circle(id) or created_by = auth.uid());

-- Members see each other, because a chilimba where you cannot see who else is
-- in it and who has paid is exactly the chilimba that goes wrong.
drop policy if exists "members see each other" on public.chilimba_members;
create policy "members see each other"
  on public.chilimba_members for select using (public.in_circle(circle_id));

drop policy if exists "members see contributions" on public.chilimba_contributions;
create policy "members see contributions"
  on public.chilimba_contributions for select using (public.in_circle(circle_id));

drop policy if exists "members see payouts" on public.chilimba_payouts;
create policy "members see payouts"
  on public.chilimba_payouts for select using (public.in_circle(circle_id));

-- Only a member may change their own auto-contribute setting; everything else
-- moves through the functions below, which enforce the rules.
drop policy if exists "members set their own auto-contribute" on public.chilimba_members;
create policy "members set their own auto-contribute"
  on public.chilimba_members for update
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ============================================================
-- Can this person afford it?
-- ============================================================
create or replace function public.chilimba_income_share()
returns numeric language sql immutable as $$ select 0.25::numeric; $$;

comment on function public.chilimba_income_share is
  'The most of recent Nchito income a member may commit to circles. A quarter
   is already aggressive for saving; above it a missed cycle stops being an
   inconvenience and starts being a default that costs other people money.';

create or replace function public.chilimba_affordable(
  p_user uuid, p_contribution numeric, p_cadence chilimba_cadence)
returns table (ok boolean, obligation numeric, recent_income numeric, reason text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_income     numeric;
  v_per_90     numeric;
  v_obligation numeric;
  v_existing   numeric;
begin
  select coalesce(sum(amount_zmw), 0) into v_income
    from public.wallet_transactions
   where user_id = p_user
     and amount_zmw > 0
     and kind in ('gig_payout', 'task_reward', 'referral_bonus')
     and created_at > now() - interval '90 days';

  v_per_90 := 90.0 / public.cadence_days(p_cadence);
  v_obligation := p_contribution * v_per_90;

  -- Circles already joined count too, or three affordable circles add up to
  -- one unaffordable commitment.
  select coalesce(sum(c.contribution_zmw * (90.0 / public.cadence_days(c.cadence))), 0)
    into v_existing
    from public.chilimba_members m
    join public.chilimba_circles c on c.id = m.circle_id
   where m.member_id = p_user
     and m.status = 'active'
     and c.status in ('forming', 'active');

  if v_income <= 0 then
    return query select false, v_obligation, v_income,
      'You have not been paid through Nchito in the last 90 days, so there is nothing to judge this against. Finish a gig first.'::text;
  elsif v_obligation + v_existing > v_income * public.chilimba_income_share() then
    return query select false, v_obligation, v_income,
      format('This would commit K%s over 90 days against K%s earned. Nchito caps circles at %s%% of recent income, because a missed cycle costs the other members, not just you.',
             round(v_obligation + v_existing, 2), round(v_income, 2),
             round(public.chilimba_income_share() * 100))::text;
  else
    return query select true, v_obligation, v_income, 'ok'::text;
  end if;
end;
$$;

grant execute on function public.chilimba_affordable(uuid, numeric, chilimba_cadence) to authenticated;

-- ============================================================
-- Creating and joining
-- ============================================================
create or replace function public.create_chilimba(
  p_name text, p_contribution numeric, p_cadence chilimba_cadence, p_members int)
returns table (circle_id uuid, invite_code text)
language plpgsql security definer set search_path = public
as $$
declare
  v_circle uuid;
  v_code   text;
  v_afford record;
begin
  perform public.chilimba_require_enabled();
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;

  select * into v_afford from public.chilimba_affordable(auth.uid(), p_contribution, p_cadence);
  if not v_afford.ok then
    raise exception '%', v_afford.reason using errcode = 'check_violation';
  end if;

  v_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));

  insert into public.chilimba_circles (name, created_by, contribution_zmw, cadence, member_target, invite_code)
  values (trim(p_name), auth.uid(), p_contribution, p_cadence, p_members, v_code)
  returning id into v_circle;

  insert into public.chilimba_members (circle_id, member_id) values (v_circle, auth.uid());

  return query select v_circle, v_code;
end;
$$;

create or replace function public.join_chilimba(p_invite_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_circle public.chilimba_circles%rowtype;
  v_count  int;
  v_afford record;
begin
  perform public.chilimba_require_enabled();
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;

  select * into v_circle from public.chilimba_circles
   where invite_code = upper(trim(p_invite_code));
  if not found then
    return 'No circle with that code.';
  end if;
  if v_circle.status <> 'forming' then
    return 'That circle has already started. You cannot join part-way through — the turn order is already set.';
  end if;

  select count(*) into v_count from public.chilimba_members
   where circle_id = v_circle.id and status = 'active';
  if v_count >= v_circle.member_target then
    return 'That circle is full.';
  end if;
  if exists (select 1 from public.chilimba_members
              where circle_id = v_circle.id and member_id = auth.uid()) then
    return 'You are already in this circle.';
  end if;

  select * into v_afford
    from public.chilimba_affordable(auth.uid(), v_circle.contribution_zmw, v_circle.cadence);
  if not v_afford.ok then
    return v_afford.reason;
  end if;

  insert into public.chilimba_members (circle_id, member_id) values (v_circle.id, auth.uid());

  -- Fills up, starts itself. Waiting on the founder to press a button is how a
  -- circle sits half-formed for a month.
  if v_count + 1 >= v_circle.member_target then
    perform public.activate_chilimba(v_circle.id);
    return format('You have joined %s. The circle is full, so it has started and the turn order has been drawn.', v_circle.name);
  end if;

  return format('You have joined %s. Waiting for %s more member(s).',
                v_circle.name, v_circle.member_target - v_count - 1);
end;
$$;

-- ============================================================
-- Drawing the order
-- ============================================================
create or replace function public.activate_chilimba(p_circle uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_seed text;
  r      record;
  i      int := 0;
begin
  perform public.chilimba_require_enabled();

  if (select status from public.chilimba_circles where id = p_circle) <> 'forming' then
    raise exception 'this circle has already started';
  end if;

  -- The seed is stored so anybody can re-run the ordering and check it. An
  -- unverifiable "random" order is worth nothing to a member who went last.
  v_seed := encode(extensions.gen_random_bytes(8), 'hex');

  for r in
    select id from public.chilimba_members
     where circle_id = p_circle and status = 'active'
     order by md5(v_seed || id::text)
  loop
    i := i + 1;
    update public.chilimba_members set position = i where id = r.id;
  end loop;

  update public.chilimba_circles
     set status = 'active', current_round = 1, order_seed = v_seed, started_at = now()
   where id = p_circle;
end;
$$;

-- ============================================================
-- Paying in
-- ============================================================
create or replace function public.chilimba_contribute(p_circle uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_circle  public.chilimba_circles%rowtype;
  v_member  public.chilimba_members%rowtype;
  v_balance numeric;
begin
  perform public.chilimba_require_enabled();

  select * into v_circle from public.chilimba_circles where id = p_circle;
  if not found or v_circle.status <> 'active' then
    return 'That circle is not running.';
  end if;

  select * into v_member from public.chilimba_members
   where circle_id = p_circle and member_id = auth.uid() and status = 'active';
  if not found then
    return 'You are not a member of this circle.';
  end if;

  if exists (select 1 from public.chilimba_contributions
              where circle_id = p_circle and round = v_circle.current_round
                and member_id = auth.uid()) then
    return format('You have already paid for round %s.', v_circle.current_round);
  end if;

  v_balance := public.wallet_balance(auth.uid());
  if v_balance < v_circle.contribution_zmw then
    return format('You need K%s in your wallet and you have K%s.',
                  round(v_circle.contribution_zmw, 2), round(v_balance, 2));
  end if;

  insert into public.chilimba_contributions (circle_id, round, member_id, amount_zmw, source)
  values (p_circle, v_circle.current_round, auth.uid(), v_circle.contribution_zmw, 'wallet');

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
  values (auth.uid(), 'chilimba_in', -v_circle.contribution_zmw,
          format('%s — round %s', v_circle.name, v_circle.current_round));

  perform public.chilimba_settle_round(p_circle);

  return format('K%s paid into %s for round %s.',
                round(v_circle.contribution_zmw, 2), v_circle.name, v_circle.current_round);
end;
$$;

-- ============================================================
-- Closing a round
-- ============================================================
-- Runs after every contribution. Nobody collects a pot that is short, so this
-- does nothing at all until the last member has paid.
create or replace function public.chilimba_settle_round(p_circle uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_circle    public.chilimba_circles%rowtype;
  v_active    int;
  v_paid      int;
  v_recipient uuid;
  v_pot       numeric;
begin
  select * into v_circle from public.chilimba_circles where id = p_circle for update;
  if v_circle.status <> 'active' then
    return false;
  end if;

  select count(*) into v_active from public.chilimba_members
   where circle_id = p_circle and status = 'active';
  select count(*) into v_paid from public.chilimba_contributions
   where circle_id = p_circle and round = v_circle.current_round;

  if v_paid < v_active then
    return false;
  end if;

  select member_id into v_recipient from public.chilimba_members
   where circle_id = p_circle and position = v_circle.current_round and status = 'active';

  -- The member whose turn it is has left. The pot is not redistributed
  -- silently — the round is skipped and the money stays with whoever paid it,
  -- because quietly reassigning somebody else's turn is how trust dies.
  if v_recipient is null then
    update public.chilimba_circles
       set current_round = current_round + 1 where id = p_circle;
    return false;
  end if;

  select coalesce(sum(amount_zmw), 0) into v_pot from public.chilimba_contributions
   where circle_id = p_circle and round = v_circle.current_round;

  insert into public.chilimba_payouts (circle_id, round, recipient_id, amount_zmw)
  values (p_circle, v_circle.current_round, v_recipient, v_pot);

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
  values (v_recipient, 'chilimba_out', v_pot,
          format('%s — your turn (round %s)', v_circle.name, v_circle.current_round));

  if v_circle.current_round >= (select max(position) from public.chilimba_members
                                 where circle_id = p_circle and status = 'active') then
    update public.chilimba_circles
       set status = 'completed', completed_at = now() where id = p_circle;
  else
    update public.chilimba_circles
       set current_round = current_round + 1 where id = p_circle;
  end if;

  return true;
end;
$$;

-- ============================================================
-- Where a member actually stands
-- ============================================================
-- The number that matters and that paper chilimbas never show anybody: what
-- you have put in, what you have taken out, and therefore what walking away
-- would cost the people who trusted you.
create or replace function public.chilimba_position(p_circle uuid, p_member uuid default null)
returns table (
  paid_in        numeric,
  received       numeric,
  net            numeric,
  turn_position  int,
  rounds_left    int,
  exit_cost      numeric,
  may_leave      boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_user   uuid := coalesce(p_member, auth.uid());
  v_circle public.chilimba_circles%rowtype;
  v_in     numeric;
  v_out    numeric;
  v_pos    int;
  v_total  int;
begin
  select * into v_circle from public.chilimba_circles where id = p_circle;

  select coalesce(sum(amount_zmw), 0) into v_in from public.chilimba_contributions
   where circle_id = p_circle and member_id = v_user;
  select coalesce(sum(amount_zmw), 0) into v_out from public.chilimba_payouts
   where circle_id = p_circle and recipient_id = v_user;
  select position into v_pos from public.chilimba_members
   where circle_id = p_circle and member_id = v_user;
  select count(*) into v_total from public.chilimba_members
   where circle_id = p_circle and status = 'active';

  return query select
    v_in,
    v_out,
    v_in - v_out,
    v_pos,
    greatest(v_total - coalesce(v_circle.current_round, 0) + 1, 0),
    -- Owed only if you are ahead: you have collected more than you have paid.
    greatest(v_out - v_in, 0),
    (v_out - v_in) <= 0;
end;
$$;

grant execute on function public.chilimba_position(uuid, uuid) to authenticated;

create or replace function public.chilimba_leave(p_circle uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
begin
  perform public.chilimba_require_enabled();
  select * into v_pos from public.chilimba_position(p_circle, auth.uid());

  if not v_pos.may_leave then
    return format(
      'You have received K%s and paid in K%s. Leaving now would take K%s out of the other members'' pockets. Settle the difference first.',
      round(v_pos.received, 2), round(v_pos.paid_in, 2), round(v_pos.exit_cost, 2));
  end if;

  update public.chilimba_members
     set status = 'left', left_at = now(), position = null
   where circle_id = p_circle and member_id = auth.uid();

  -- A circle still forming shrinks; one already running keeps its order, and
  -- the leaver's round is skipped rather than handed to somebody else.
  return 'You have left the circle. Everything you paid in has already gone to whoever''s turn it was.';
end;
$$;

-- ============================================================
-- Reading a circle
-- ============================================================
create or replace function public.chilimba_round_state(p_circle uuid)
returns table (
  round         int,
  pot           numeric,
  recipient_id  uuid,
  recipient_name text,
  paid_count    int,
  member_count  int,
  outstanding   text[]
)
language sql stable security definer set search_path = public
as $$
  select
    c.current_round,
    c.contribution_zmw * (select count(*) from public.chilimba_members m
                           where m.circle_id = c.id and m.status = 'active'),
    r.member_id,
    rp.full_name,
    (select count(*)::int from public.chilimba_contributions k
      where k.circle_id = c.id and k.round = c.current_round),
    (select count(*)::int from public.chilimba_members m
      where m.circle_id = c.id and m.status = 'active'),
    -- Named, not counted. "Two people still to pay" starts an argument;
    -- "Mercy and Joseph still to pay" starts a phone call.
    array(select p.full_name
            from public.chilimba_members m
            join public.profiles p on p.id = m.member_id
           where m.circle_id = c.id and m.status = 'active'
             and not exists (select 1 from public.chilimba_contributions k
                              where k.circle_id = c.id and k.round = c.current_round
                                and k.member_id = m.member_id)
           order by p.full_name)
  from public.chilimba_circles c
  left join public.chilimba_members r
         on r.circle_id = c.id and r.position = c.current_round and r.status = 'active'
  left join public.profiles rp on rp.id = r.member_id
  where c.id = p_circle;
$$;

grant execute on function public.chilimba_round_state(uuid) to authenticated;

create or replace function public.my_chilimbas()
returns table (
  circle_id     uuid,
  name          text,
  contribution  numeric,
  cadence       chilimba_cadence,
  status        chilimba_status,
  current_round int,
  member_count  int,
  my_position   int,
  invite_code   text
)
language sql stable security definer set search_path = public
as $$
  select c.id, c.name, c.contribution_zmw, c.cadence, c.status, c.current_round,
         (select count(*)::int from public.chilimba_members m2
           where m2.circle_id = c.id and m2.status = 'active'),
         m.position,
         case when c.status = 'forming' then c.invite_code else null end
    from public.chilimba_circles c
    join public.chilimba_members m on m.circle_id = c.id and m.member_id = auth.uid()
   where m.status = 'active'
   order by c.created_at desc;
$$;

grant execute on function public.my_chilimbas() to authenticated;
grant execute on function public.create_chilimba(text, numeric, chilimba_cadence, int) to authenticated;
grant execute on function public.join_chilimba(text) to authenticated;
grant execute on function public.chilimba_contribute(uuid) to authenticated;
grant execute on function public.chilimba_leave(uuid) to authenticated;
grant execute on function public.chilimba_enabled() to anon, authenticated;

-- activate and settle are internal steps, reached only through join and
-- contribute. Exposing them would let a member draw the order early or close a
-- round that is short.
revoke execute on function public.activate_chilimba(uuid) from anon, authenticated;
revoke execute on function public.chilimba_settle_round(uuid) from anon, authenticated;

-- ============================================================
-- Auto-contribution out of a settled gig
-- ============================================================
-- INNOVATION.md §3.3 describes a slice of each payout going into the circle.
-- Re-declared here rather than patched, because release_escrow is the one
-- function in this schema where the ORDER of deductions is the whole argument:
--
--   1. The early-payment advance, which is money already handed over.
--   2. The chilimba contribution, but only if the member switched it on, only
--      for the round actually open, and only if it still leaves them positive.
--   3. Whatever is left, to the worker.
--
-- A contribution that pushes someone negative is not saving, it is an
-- overdraft they did not ask for, so it is skipped and they pay by hand.
create or replace function public.release_escrow(p_gig_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g record;
  rate numeric;
  payout numeric;
  advance public.wage_advances;
  net numeric;
  v_settled_at timestamptz := now();
  was_on_time boolean;
  circ record;
begin
  select * into g from public.gigs where id = p_gig_id for update;
  if g is null then raise exception 'gig not found'; end if;
  if g.poster_id <> auth.uid() then raise exception 'only the poster can release escrow'; end if;
  if g.status <> 'completed' then raise exception 'gig must be marked completed first'; end if;
  if g.assigned_worker is null then raise exception 'no worker assigned'; end if;
  if not public.has_complete_proof(p_gig_id) then
    raise exception 'before and after proof photos are required before release';
  end if;

  rate := public.commission_rate(g.poster_id, g.assigned_worker);
  payout := round(g.pay_zmw * (1 - rate), 2);

  select * into advance from public.wage_advances
   where gig_id = p_gig_id and status = 'outstanding' for update;

  net := payout;
  if advance.id is not null then
    if advance.total_due_zmw > payout then
      raise exception 'advance exceeds payout for gig %', p_gig_id;
    end if;

    insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
    values (g.assigned_worker, 'advance_repayment', -advance.total_due_zmw,
            'Early payment repaid (' || to_char(advance.amount_zmw, 'FM999999990') ||
            ' + ' || to_char(advance.fee_zmw, 'FM999999990.00') || ' fee)', g.id);

    update public.wage_advances
       set status = 'settled', settled_at = v_settled_at
     where id = advance.id;

    net := payout - advance.total_due_zmw;
  end if;

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (g.assigned_worker, 'gig_payout', payout,
          g.title || ' (' || round(rate * 100) || '% fee)', g.id);

  -- One circle per settlement. Someone in three circles pays the other two by
  -- hand, rather than having a single gig quietly emptied by standing orders.
  if public.chilimba_enabled() then
    select c.id, c.name, c.contribution_zmw, c.current_round
      into circ
      from public.chilimba_members m
      join public.chilimba_circles c on c.id = m.circle_id
     where m.member_id = g.assigned_worker
       and m.status = 'active'
       and m.auto_contribute
       and c.status = 'active'
       and not exists (
         select 1 from public.chilimba_contributions k
          where k.circle_id = c.id and k.round = c.current_round
            and k.member_id = g.assigned_worker)
     order by c.created_at
     limit 1;

    if circ.id is not null and net >= circ.contribution_zmw then
      insert into public.chilimba_contributions
        (circle_id, round, member_id, amount_zmw, source)
      values (circ.id, circ.current_round, g.assigned_worker,
              circ.contribution_zmw, 'payout_split');

      insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
      values (g.assigned_worker, 'chilimba_in', -circ.contribution_zmw,
              circ.name || ' — round ' || circ.current_round || ' (from this gig)', g.id);

      perform public.chilimba_settle_round(circ.id);
    end if;
  end if;

  select coalesce(max(captured_at) <= coalesce(g.due_at, 'infinity'::timestamptz), true)
    into was_on_time
    from public.proof_of_work
   where gig_id = g.id and kind = 'after';

  insert into public.work_records (
    worker_id, gig_id, title, category, city, pay_zmw,
    completed_at, poster_rating, on_time, signature)
  values (
    g.assigned_worker, g.id, g.title, g.category, g.city, g.pay_zmw,
    v_settled_at, g.worker_rating, was_on_time,
    encode(extensions.hmac(
      public.work_record_payload(g.assigned_worker, g.id, g.title, g.category,
                                 g.pay_zmw, v_settled_at, g.worker_rating, was_on_time),
      public.work_record_secret(), 'sha256'), 'hex'))
  on conflict (gig_id) do nothing;

  update public.gigs set status = 'paid' where id = g.id;
end $$;
