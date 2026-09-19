-- Nchito — earned wage access (see nchito-ios/INNOVATION.md §3.2)
--
-- The single reason a worker takes a cash job over a Nchito gig is that cash
-- pays today. This closes that gap: once work is verifiably underway, release
-- part of the payout immediately.
--
-- IT IS NOT A LOAN, and the distinction is structural rather than cosmetic.
-- The poster has already funded escrow, so Nchito is holding this worker's
-- money. An advance is early release of funds already deposited against work
-- already started — no credit is extended, nothing accrues, and there is no
-- interest. The fee is flat, quoted in kwacha before the worker agrees, and
-- does not grow with time.
--
-- The real exposure is narrow: a worker takes an advance and then abandons the
-- gig, leaving Nchito to refund the poster from money already paid out. Four
-- things bound it — work must have demonstrably started (proof photo), the
-- advance is capped well below the payout, the worker must have standing, and
-- an abandoned gig converts the balance into a recoverable obligation.

-- ============================================================
-- 1. Ledger kinds
-- ============================================================

alter type tx_kind add value if not exists 'wage_advance';        -- credit to worker
alter type tx_kind add value if not exists 'advance_repayment';   -- debit at settlement
alter type tx_kind add value if not exists 'advance_recovery';    -- debit after abandonment

-- ============================================================
-- 2. Terms
-- ============================================================

create type advance_status as enum ('outstanding', 'settled', 'recovering', 'written_off');

create table public.wage_advances (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id),
  gig_id uuid not null references public.gigs(id),
  amount_zmw numeric(10,2) not null check (amount_zmw > 0),
  fee_zmw numeric(10,2) not null check (fee_zmw >= 0),
  total_due_zmw numeric(10,2) not null,
  status advance_status not null default 'outstanding',
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  -- One advance per gig. Topping up would let a worker creep past the cap in
  -- steps, and it makes the repayment arithmetic at settlement ambiguous.
  unique (gig_id)
);
create index wage_advances_worker_idx on public.wage_advances (worker_id, status);

-- Share of the worker's payout that may be released early. Half leaves ample
-- headroom for the fee and for a commission tier that is never worse than the
-- one quoted, so repayment is always fully covered by the escrow.
create or replace function public.advance_max_share()
returns numeric language sql immutable as $$ select 0.50::numeric $$;

-- Flat service fee: 4% of the amount advanced, minimum K5. Not interest — it
-- does not compound and does not grow if settlement takes longer.
create or replace function public.advance_fee(p_amount numeric)
returns numeric language sql immutable as $$
  select greatest(round(p_amount * 0.04, 2), 5.00);
$$;

-- ============================================================
-- 3. Eligibility
-- ============================================================

-- Returns the offer, or the reason there isn't one. Written to be readable by a
-- human: the apps show `reason` verbatim when `eligible` is false, so a refusal
-- always explains itself rather than greying out a button.
create or replace function public.advance_eligibility(p_worker uuid, p_gig_id uuid)
returns table (eligible boolean, max_amount numeric, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  g public.gigs;
  rate numeric;
  payout numeric;
  cap numeric;
  record_count int;
  on_time_rate numeric;
  outstanding int;
begin
  select * into g from public.gigs where id = p_gig_id;

  if g.id is null then
    return query select false, 0::numeric, 'That gig no longer exists.'; return;
  end if;
  if g.assigned_worker is distinct from p_worker then
    return query select false, 0::numeric, 'You are not the assigned worker on this gig.'; return;
  end if;
  if g.status not in ('assigned', 'completed') then
    return query select false, 0::numeric,
      'Advances are only available once a gig is assigned to you.'; return;
  end if;

  if exists (select 1 from public.wage_advances
              where gig_id = p_gig_id and status <> 'written_off') then
    return query select false, 0::numeric,
      'You have already taken an advance on this gig.'; return;
  end if;

  -- Work must demonstrably have started. The "before" photo carries a device
  -- capture time and location, so this is evidence rather than a claim — and it
  -- is exactly why proof-of-work had to exist before this feature could.
  if not exists (select 1 from public.proof_of_work
                  where gig_id = p_gig_id and kind = 'before') then
    return query select false, 0::numeric,
      'Take your "before" photo on this gig first — that is what shows the work has started.'; return;
  end if;

  -- Standing, read from the Work Record. Someone with no settled history has
  -- shown nothing about whether they finish what they start.
  select count(*)::int,
         case when count(*) = 0 then null
              else 1.0 * count(*) filter (where w.on_time) / count(*) end
    into record_count, on_time_rate
    from public.work_records w where w.worker_id = p_worker;

  if record_count < 3 then
    return query select false, 0::numeric,
      'Complete 3 jobs through Nchito to unlock early payment.'; return;
  end if;
  if coalesce(on_time_rate, 0) < 0.6 then
    return query select false, 0::numeric,
      'Early payment needs most of your recent jobs delivered on time.'; return;
  end if;

  -- One outstanding advance at a time. Stacking advances across gigs is how a
  -- worker ends up owing more than they are about to earn.
  select count(*)::int into outstanding
    from public.wage_advances
   where worker_id = p_worker and status in ('outstanding', 'recovering');

  if outstanding > 0 then
    return query select false, 0::numeric,
      'Finish the gig you already took an advance on first.'; return;
  end if;

  rate := public.commission_rate(g.poster_id, p_worker);
  payout := round(g.pay_zmw * (1 - rate), 2);
  cap := floor(payout * public.advance_max_share());

  if cap < 20 then
    return query select false, 0::numeric,
      'This gig is too small for an early payment.'; return;
  end if;

  return query select true, cap, 'You can take up to ' ||
    to_char(cap, 'FM999999990') || ' kwacha now.';
end $$;

-- ============================================================
-- 4. Taking an advance
-- ============================================================

create or replace function public.request_wage_advance(p_gig_id uuid, p_amount numeric)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  check_row record;
  fee numeric;
begin
  if me is null then raise exception 'not signed in'; end if;

  -- Re-check rather than trusting whatever the client last saw; eligibility may
  -- have changed since the screen was drawn.
  select * into check_row from public.advance_eligibility(me, p_gig_id);
  if not check_row.eligible then return check_row.reason; end if;

  if p_amount is null or p_amount <= 0 then return 'Enter a valid amount.'; end if;
  if p_amount > check_row.max_amount then
    return 'The most you can take on this gig is ' ||
           to_char(check_row.max_amount, 'FM999999990') || ' kwacha.';
  end if;

  fee := public.advance_fee(p_amount);

  insert into public.wage_advances (worker_id, gig_id, amount_zmw, fee_zmw, total_due_zmw)
  values (me, p_gig_id, p_amount, fee, p_amount + fee);

  -- The worker receives the full amount; the fee is taken at settlement, so
  -- what lands in the wallet is exactly what was quoted.
  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (me, 'wage_advance', p_amount, 'Early payment on ' ||
          (select title from public.gigs where id = p_gig_id), p_gig_id);

  return 'Paid ' || to_char(p_amount, 'FM999999990.00') ||
         ' kwacha now. ' || to_char(p_amount + fee, 'FM999999990.00') ||
         ' will come off this gig when it settles.';
end $$;

-- ============================================================
-- 5. Settlement — repay before crediting
-- ============================================================

-- Replaces the version in 0003. Same proof gate, commission tiering and Work
-- Record entry; now an outstanding advance is repaid out of the payout first,
-- so the worker only ever sees the net.
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
    -- The cap guarantees this, but assert it rather than silently paying out a
    -- negative amount if the terms are ever changed.
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

-- ============================================================
-- 6. Abandonment
-- ============================================================

-- When an advanced gig is cancelled the escrow goes back to the poster, so the
-- advance becomes an obligation of the worker's. It is recovered from future
-- earnings rather than chased: the wallet is where their money arrives, and a
-- worker who keeps working repays without anyone having to pursue them.
create or replace function public.cancel_advanced_gig(p_gig_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare advance public.wage_advances;
begin
  select * into advance from public.wage_advances
   where gig_id = p_gig_id and status = 'outstanding' for update;

  if advance.id is null then return; end if;

  update public.wage_advances set status = 'recovering' where id = advance.id;

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (advance.worker_id, 'advance_recovery', -advance.total_due_zmw,
          'Early payment owed back — gig not completed', p_gig_id);
end $$;

-- What a worker still owes, if anything. The apps surface this plainly rather
-- than letting a balance quietly go negative with no explanation.
create or replace function public.outstanding_advance(p_worker uuid)
returns table (amount_zmw numeric, fee_zmw numeric, total_due_zmw numeric,
               gig_title text, status advance_status)
language sql stable security definer set search_path = public as $$
  select a.amount_zmw, a.fee_zmw, a.total_due_zmw, g.title, a.status
    from public.wage_advances a
    join public.gigs g on g.id = a.gig_id
   where a.worker_id = p_worker and a.status in ('outstanding', 'recovering')
   order by a.created_at desc
   limit 1;
$$;

-- ============================================================
-- 7. Channel access (USSD / WhatsApp)
-- ============================================================

-- Same authorise-by-phone pattern as 0004: Edge Functions bypass RLS, so the
-- function resolves the caller itself and never trusts a passed-in identity.
create or replace function public.channel_advance_offer(p_phone text)
returns table (gig_id uuid, title text, max_amount numeric)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; g record;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return; end if;

  for g in select id, title from public.gigs
            where assigned_worker = me.id and status in ('assigned', 'completed')
            order by created_at desc limit 5
  loop
    return query
      select g.id, g.title, e.max_amount
        from public.advance_eligibility(me.id, g.id) e
       where e.eligible;
  end loop;
end $$;

-- Taking an advance moves money, so it needs the same PIN as cash-out. The PIN
-- is verified here, in the database, not in the Edge Function.
create or replace function public.channel_take_advance(
  p_phone text, p_gig_id uuid, p_amount numeric, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare me public.profiles; check_row record; fee numeric;
begin
  me := public.channel_profile(p_phone);
  if me.id is null then return 'You are not registered on Nchito.'; end if;

  if me.channel_locked_until is not null and me.channel_locked_until > now() then
    return 'Too many wrong PINs. Try again in 30 minutes.';
  end if;
  if me.channel_pin_hash is null then
    return 'Set a PIN in the Nchito app before taking early payment.';
  end if;
  if extensions.crypt(p_pin, me.channel_pin_hash) <> me.channel_pin_hash then
    update public.profiles
       set channel_locked_until = case
             when channel_locked_until is null then now() + interval '2 minutes'
             else now() + interval '30 minutes' end
     where id = me.id;
    return 'Wrong PIN.';
  end if;
  update public.profiles set channel_locked_until = null where id = me.id;

  select * into check_row from public.advance_eligibility(me.id, p_gig_id);
  if not check_row.eligible then return check_row.reason; end if;
  if p_amount is null or p_amount <= 0 or p_amount > check_row.max_amount then
    return 'The most you can take is ' || to_char(check_row.max_amount, 'FM999999990') || ' kwacha.';
  end if;

  fee := public.advance_fee(p_amount);

  insert into public.wage_advances (worker_id, gig_id, amount_zmw, fee_zmw, total_due_zmw)
  values (me.id, p_gig_id, p_amount, fee, p_amount + fee);

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (me.id, 'wage_advance', p_amount, 'Early payment via mobile', p_gig_id);

  return 'Paid ' || to_char(p_amount, 'FM999999990') || ' kwacha. ' ||
         to_char(p_amount + fee, 'FM999999990.00') || ' comes off when the gig settles.';
end $$;

-- ============================================================
-- 8. Permissions
-- ============================================================

alter table public.wage_advances enable row level security;

create policy "own advances readable" on public.wage_advances
  for select to authenticated using (worker_id = auth.uid());

-- Signed-in app callers: these authorise through auth.uid().
grant execute on function public.request_wage_advance(uuid, numeric) to authenticated;
grant execute on function public.advance_eligibility(uuid, uuid) to authenticated;
grant execute on function public.outstanding_advance(uuid) to authenticated;

-- Channel functions take a phone number as identity, so they must never be
-- reachable from a browser where anyone could pass someone else's.
revoke execute on function public.channel_advance_offer(text) from anon, authenticated;
revoke execute on function public.channel_take_advance(text, uuid, numeric, text) from anon, authenticated;
revoke execute on function public.cancel_advanced_gig(uuid) from anon, authenticated;
