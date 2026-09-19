-- Nchito — Phase 1 of the innovation roadmap (see nchito-ios/INNOVATION.md)
--
-- Three changes, all aimed at disintermediation (research puts leakage at up
-- to 90% of jobs on comparable platforms):
--   1. Loyalty-decaying commission — the longer a pair works together, the
--      less Nchito takes, so going off-platform stops being worth it.
--   2. Proof-of-work capture — geotagged, timestamped before/after photos
--      that gate escrow release and kill most disputes.
--   3. Fair-price bands — comparable-gig pricing so posting is fast and fair.

-- ============================================================
-- 1. Loyalty-decaying commission
-- ============================================================

-- How many gigs this exact poster→worker pair has completed and been paid for.
-- Counting only 'paid' gigs means the discount is earned through settled work,
-- never through gigs merely posted or abandoned mid-way.
create or replace function public.pair_completed_count(p_poster uuid, p_worker uuid)
returns int language sql stable as $$
  select count(*)::int
  from public.gigs
  where poster_id = p_poster
    and assigned_worker = p_worker
    and status = 'paid';
$$;

-- Tiers: 10% for the first two gigs together, 7% from the third, 5% from the
-- tenth. At 5% the saving from settling in cash no longer covers the loss of
-- escrow, recourse and Work Record credit.
create or replace function public.commission_rate(p_poster uuid, p_worker uuid)
returns numeric language sql stable as $$
  select case
    when public.pair_completed_count(p_poster, p_worker) >= 10 then 0.05
    when public.pair_completed_count(p_poster, p_worker) >= 3  then 0.07
    else 0.10
  end;
$$;

-- ============================================================
-- 2. Proof of work
-- ============================================================

create type proof_kind as enum ('before', 'after');

create table public.proof_of_work (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  worker_id uuid not null references public.profiles(id),
  kind proof_kind not null,
  storage_path text not null,          -- object in the 'proofs' storage bucket
  captured_at timestamptz not null,    -- device capture time, not upload time
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  unique (gig_id, kind)                -- one before and one after per gig
);
create index proof_gig_idx on public.proof_of_work (gig_id);

create or replace function public.has_complete_proof(p_gig_id uuid)
returns boolean language sql stable as $$
  select count(distinct kind) = 2 from public.proof_of_work where gig_id = p_gig_id;
$$;

-- ============================================================
-- 3. Escrow release — now proof-gated and tier-priced
-- ============================================================

-- Replaces the flat 0.90 payout from 0001_init.sql.
create or replace function public.release_escrow(p_gig_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g record;
  rate numeric;
  payout numeric;
begin
  select * into g from public.gigs where id = p_gig_id for update;
  if g is null then raise exception 'gig not found'; end if;
  if g.poster_id <> auth.uid() then raise exception 'only the poster can release escrow'; end if;
  if g.status <> 'completed' then raise exception 'gig must be marked completed first'; end if;
  if g.assigned_worker is null then raise exception 'no worker assigned'; end if;
  if not public.has_complete_proof(p_gig_id) then
    raise exception 'before and after proof photos are required before release';
  end if;

  -- Rate is computed from history BEFORE this gig settles, so the discount
  -- applies from the next one — the tier shown in the app while the gig was
  -- open is the tier actually charged.
  rate := public.commission_rate(g.poster_id, g.assigned_worker);
  payout := round(g.pay_zmw * (1 - rate), 2);

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (g.assigned_worker, 'gig_payout', payout,
          g.title || ' (' || round(rate * 100) || '% fee)', g.id);

  update public.gigs set status = 'paid' where id = g.id;
end $$;

-- ============================================================
-- 4. Fair-price bands
-- ============================================================

-- Quartiles over settled gigs in the same category, preferring the same city
-- and falling back to nationwide when a city is too thin to be meaningful.
-- Returns nulls when there isn't enough history to advise on; callers must
-- handle that rather than showing a made-up number.
create or replace function public.price_band(p_category gig_category, p_city text)
returns table (low numeric, median numeric, high numeric, sample_size int)
language plpgsql stable as $$
declare min_sample constant int := 5;
begin
  return query
  with local_gigs as (
    select pay_zmw from public.gigs
    where category = p_category and city = p_city and status = 'paid'
  ),
  national_gigs as (
    select pay_zmw from public.gigs
    where category = p_category and status = 'paid'
  ),
  chosen as (
    select * from local_gigs
    where (select count(*) from local_gigs) >= min_sample
    union all
    select * from national_gigs
    where (select count(*) from local_gigs) < min_sample
  )
  select
    round(percentile_cont(0.25) within group (order by pay_zmw)::numeric, 2),
    round(percentile_cont(0.50) within group (order by pay_zmw)::numeric, 2),
    round(percentile_cont(0.75) within group (order by pay_zmw)::numeric, 2),
    count(*)::int
  from chosen
  having count(*) >= min_sample;
end $$;

-- ============================================================
-- RLS for the new table
-- ============================================================
alter table public.proof_of_work enable row level security;

create policy "worker uploads own proof" on public.proof_of_work
  for insert to authenticated with check (
    worker_id = auth.uid()
    and exists (select 1 from public.gigs g
                where g.id = gig_id and g.assigned_worker = auth.uid())
  );

create policy "gig parties read proof" on public.proof_of_work
  for select to authenticated using (
    worker_id = auth.uid()
    or exists (select 1 from public.gigs g
               where g.id = gig_id and g.poster_id = auth.uid())
  );
