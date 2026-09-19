-- Nchito — the Work Record (see nchito-ios/INNOVATION.md §1.2)
--
-- Zambia's informal workers have no verifiable employment history. A cleaner
-- with eight years of excellent service has nothing to show a new employer, a
-- bank or a landlord. This turns every settled gig into a signed, tamper-evident
-- entry the worker owns and can prove.
--
-- Two properties make it worth something:
--   * It cannot be self-reported. Entries are written only by release_escrow(),
--     so every line represents money that actually moved through escrow.
--   * It cannot be quietly edited. Each entry carries an HMAC over its content,
--     so anyone can verify a shared record wasn't altered after the fact.
--
-- It is also the anti-leakage weapon that needs no enforcement: work settled in
-- cash off-platform simply doesn't count.

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 0. Columns the record needs from the gig
-- ============================================================

-- due_at lets punctuality be judged objectively instead of by memory;
-- worker_rating is the poster's rating OF the worker, which is what belongs in
-- the worker's history (profiles.rating is the running average of these).
alter table public.gigs
  add column if not exists due_at timestamptz,
  add column if not exists worker_rating numeric(3,2)
    check (worker_rating is null or worker_rating between 0 and 5);

-- ============================================================
-- 1. Signing
-- ============================================================

-- The signing secret lives in database settings, never in the client:
--   alter database postgres set app.settings.work_record_secret = '<random 32+ bytes>';
-- Missing secret is a hard failure — an unsigned record is worse than none,
-- because it would look verifiable while proving nothing.
create or replace function public.work_record_secret()
returns text language plpgsql stable as $$
declare s text;
begin
  s := current_setting('app.settings.work_record_secret', true);
  if s is null or length(s) < 16 then
    raise exception 'work record signing secret is not configured';
  end if;
  return s;
end $$;

-- Canonical serialisation. Field order and separator are fixed forever: change
-- them and every previously issued signature stops verifying.
create or replace function public.work_record_payload(
  p_worker uuid, p_gig uuid, p_title text, p_category gig_category,
  p_pay numeric, p_completed_at timestamptz, p_rating numeric, p_on_time boolean
) returns text language sql immutable as $$
  select concat_ws('|',
    p_worker::text,
    p_gig::text,
    p_title,
    p_category::text,
    to_char(p_pay, 'FM9999999990.00'),
    to_char(p_completed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    coalesce(to_char(p_rating, 'FM90.00'), ''),
    case when p_on_time then 'ontime' else 'late' end
  );
$$;

-- ============================================================
-- 2. The record
-- ============================================================

create table public.work_records (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  gig_id uuid not null references public.gigs(id),
  title text not null,
  category gig_category not null,
  city text not null,
  pay_zmw numeric(10,2) not null,
  completed_at timestamptz not null,
  poster_rating numeric(3,2),
  on_time boolean not null default true,
  signature text not null,
  created_at timestamptz not null default now(),
  unique (gig_id)                      -- one entry per gig, ever
);
create index work_records_worker_idx on public.work_records (worker_id, completed_at desc);

-- Entries are append-only. Even the worker cannot edit or delete their own
-- history: a record you can curate is a record nobody should trust.
create or replace function public.work_records_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'work records are append-only and cannot be % ', tg_op;
end $$;

create trigger work_records_no_update
  before update or delete on public.work_records
  for each row execute function public.work_records_immutable();

-- Recompute the signature and compare. Returns false for a tampered row.
create or replace function public.verify_work_record(p_record_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare r record; expected text;
begin
  select * into r from public.work_records where id = p_record_id;
  if r is null then return false; end if;

  expected := encode(extensions.hmac(
    public.work_record_payload(r.worker_id, r.gig_id, r.title, r.category,
                               r.pay_zmw, r.completed_at, r.poster_rating, r.on_time),
    public.work_record_secret(), 'sha256'), 'hex');

  return expected = r.signature;
end $$;

-- ============================================================
-- 3. Written at escrow release
-- ============================================================

-- Replaces the version in 0002. Same commission and proof rules, plus the
-- Work Record entry — so the history and the payment are written together or
-- not at all.
create or replace function public.release_escrow(p_gig_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g record;
  rate numeric;
  payout numeric;
  settled_at timestamptz := now();
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

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (g.assigned_worker, 'gig_payout', payout,
          g.title || ' (' || round(rate * 100) || '% fee)', g.id);

  -- Punctuality is judged against the "after" proof photo, which carries the
  -- device capture time — not against when the poster got round to releasing.
  select coalesce(max(captured_at) <= coalesce(g.due_at, 'infinity'::timestamptz), true)
    into was_on_time
    from public.proof_of_work
   where gig_id = g.id and kind = 'after';

  insert into public.work_records (
    worker_id, gig_id, title, category, city, pay_zmw,
    completed_at, poster_rating, on_time, signature)
  values (
    g.assigned_worker, g.id, g.title, g.category, g.city, g.pay_zmw,
    settled_at, g.worker_rating, was_on_time,
    encode(extensions.hmac(
      public.work_record_payload(g.assigned_worker, g.id, g.title, g.category,
                                 g.pay_zmw, settled_at, g.worker_rating, was_on_time),
      public.work_record_secret(), 'sha256'), 'hex'))
  on conflict (gig_id) do nothing;

  update public.gigs set status = 'paid' where id = g.id;
end $$;

-- ============================================================
-- 4. Sharing — opt-in, revocable
-- ============================================================

-- Employment history is sensitive, so a record is private until the worker
-- chooses otherwise, and the slug can be rotated to revoke a link already given out.
alter table public.profiles
  add column if not exists work_record_slug text unique,
  add column if not exists work_record_public boolean not null default false;

create or replace function public.set_work_record_sharing(p_public boolean, p_rotate boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare slug text;
begin
  select work_record_slug into slug from public.profiles where id = auth.uid();

  if slug is null or p_rotate then
    -- Random rather than derived from the phone number or name, so a slug
    -- reveals nothing about its owner and cannot be guessed from their profile.
    slug := lower(encode(extensions.gen_random_bytes(9), 'base64'));
    slug := replace(replace(replace(slug, '/', ''), '+', ''), '=', '');
    update public.profiles set work_record_slug = slug where id = auth.uid();
  end if;

  update public.profiles set work_record_public = p_public where id = auth.uid();
  return slug;
end $$;

-- What a verifier sees at nchito.zm/w/<slug>. SECURITY DEFINER so the table
-- itself stays closed to anonymous readers; this function is the only way out.
create or replace function public.public_work_record(p_slug text)
returns table (
  full_name text, city text, member_since timestamptz, verification verification_level,
  total_gigs int, total_earned numeric, on_time_rate numeric, average_rating numeric,
  entry_title text, entry_category gig_category, entry_city text,
  entry_pay numeric, entry_completed_at timestamptz, entry_on_time boolean,
  entry_verified boolean
) language plpgsql stable security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.profiles
   where work_record_slug = p_slug and work_record_public;
  if p is null then return; end if;   -- unknown or unshared: reveal nothing

  return query
  with entries as (
    select * from public.work_records where worker_id = p.id order by completed_at desc
  ), totals as (
    select count(*)::int as n,
           coalesce(sum(pay_zmw), 0) as earned,
           case when count(*) = 0 then null
                else round(100.0 * count(*) filter (where on_time) / count(*), 0) end as ontime,
           round(avg(poster_rating), 2) as rating
      from entries
  )
  select p.full_name, p.city, p.created_at, p.verification,
         t.n, t.earned, t.ontime, t.rating,
         e.title, e.category, e.city, e.pay_zmw, e.completed_at, e.on_time,
         public.verify_work_record(e.id)
    from totals t left join entries e on true;
end $$;

grant execute on function public.public_work_record(text) to anon;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.work_records enable row level security;

-- Workers read their own history. Nobody inserts directly — only
-- release_escrow() writes, and it runs as definer.
create policy "own work record readable" on public.work_records
  for select to authenticated using (worker_id = auth.uid());
