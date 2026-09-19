-- Nchito — initial schema
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)

-- ============================================================
-- Enums
-- ============================================================
create type verification_level as enum ('unverified', 'phone_verified', 'nrc_verified');
create type gig_status as enum ('open', 'assigned', 'completed', 'paid');
create type gig_category as enum (
  'delivery', 'home_services', 'tutoring', 'digital',
  'events', 'farm', 'beauty', 'repairs'
);
create type micro_task_kind as enum ('survey', 'app_test', 'data_label', 'social', 'mystery_shop');
create type tx_kind as enum ('gig_payout', 'task_reward', 'referral_bonus', 'cash_out', 'boost_purchase', 'escrow_in', 'escrow_refund');
create type application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');

-- ============================================================
-- Profiles (1:1 with auth.users; phone-OTP creates the auth row)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  full_name text not null default '',
  city text not null default 'Lusaka',
  bio text not null default '',
  skills text[] not null default '{}',
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  completed_gigs int not null default 0,
  verification verification_level not null default 'phone_verified',
  referral_code text unique not null,
  referred_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up via phone OTP.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, referral_code)
  values (
    new.id,
    coalesce(new.phone, ''),
    upper(substr(md5(new.id::text), 1, 6))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Gigs & applications
-- ============================================================
create table public.gigs (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id),
  title text not null,
  details text not null,
  category gig_category not null,
  pay_zmw numeric(10,2) not null check (pay_zmw > 0),
  city text not null,
  area text not null,
  status gig_status not null default 'open',
  is_urgent boolean not null default false,
  boosted_until timestamptz,           -- paid placement window (K25 / 48h)
  assigned_worker uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index gigs_feed_idx on public.gigs (status, city, category, created_at desc);

create table public.gig_applications (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references public.gigs(id) on delete cascade,
  worker_id uuid not null references public.profiles(id),
  cover_note text not null default '',
  status application_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (gig_id, worker_id)
);

-- ============================================================
-- Micro-tasks (B2B campaigns) & completions
-- ============================================================
create table public.micro_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind micro_task_kind not null,
  reward_zmw numeric(10,2) not null check (reward_zmw > 0),
  minutes int not null,
  slots_total int not null,
  slots_taken int not null default 0,
  campaign_sponsor text,               -- paying B2B client; null = platform-run
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.micro_tasks(id),
  worker_id uuid not null references public.profiles(id),
  payload jsonb not null default '{}', -- survey answers / proof
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (task_id, worker_id)
);

-- ============================================================
-- Wallet ledger (append-only; balance = sum of amounts)
-- ============================================================
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind tx_kind not null,
  amount_zmw numeric(10,2) not null,   -- negative = outflow
  note text not null default '',
  gig_id uuid references public.gigs(id),
  created_at timestamptz not null default now()
);
create index wallet_user_idx on public.wallet_transactions (user_id, created_at desc);

create or replace function public.wallet_balance(uid uuid)
returns numeric language sql stable as $$
  select coalesce(sum(amount_zmw), 0) from public.wallet_transactions where user_id = uid;
$$;

-- Escrow release: called (via RPC, by the poster) when a gig is confirmed done.
-- Credits the worker net of the 10% platform commission and marks the gig paid.
create or replace function public.release_escrow(p_gig_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g record;
begin
  select * into g from public.gigs where id = p_gig_id for update;
  if g is null then raise exception 'gig not found'; end if;
  if g.poster_id <> auth.uid() then raise exception 'only the poster can release escrow'; end if;
  if g.status <> 'completed' then raise exception 'gig must be marked completed first'; end if;
  if g.assigned_worker is null then raise exception 'no worker assigned'; end if;

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note, gig_id)
  values (g.assigned_worker, 'gig_payout', round(g.pay_zmw * 0.90, 2), g.title, g.id);

  update public.gigs set status = 'paid' where id = g.id;
end $$;

-- ============================================================
-- In-app chat
-- ============================================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid references public.gigs(id),
  participant_a uuid not null references public.profiles(id),
  participant_b uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (gig_id, participant_a, participant_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_convo_idx on public.messages (conversation_id, created_at);

-- Realtime: clients subscribe to postgres_changes on public.messages
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.gigs enable row level security;
alter table public.gig_applications enable row level security;
alter table public.micro_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Profiles: readable by all signed-in users (marketplace trust), writable by owner.
create policy "profiles are readable" on public.profiles
  for select to authenticated using (true);
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Gigs: open feed readable; posters manage their own gigs.
create policy "gigs are readable" on public.gigs
  for select to authenticated using (true);
create policy "post own gigs" on public.gigs
  for insert to authenticated with check (poster_id = auth.uid());
create policy "manage own gigs" on public.gigs
  for update to authenticated using (poster_id = auth.uid());

-- Applications: visible to the applicant and the gig poster.
create policy "applicant or poster reads" on public.gig_applications
  for select to authenticated using (
    worker_id = auth.uid()
    or exists (select 1 from public.gigs g where g.id = gig_id and g.poster_id = auth.uid())
  );
create policy "apply as self" on public.gig_applications
  for insert to authenticated with check (worker_id = auth.uid());
create policy "applicant withdraws / poster decides" on public.gig_applications
  for update to authenticated using (
    worker_id = auth.uid()
    or exists (select 1 from public.gigs g where g.id = gig_id and g.poster_id = auth.uid())
  );

-- Micro-tasks: active tasks are public; completions are insert-as-self.
create policy "active tasks readable" on public.micro_tasks
  for select to authenticated using (active);
create policy "complete as self" on public.task_completions
  for insert to authenticated with check (worker_id = auth.uid());
create policy "own completions readable" on public.task_completions
  for select to authenticated using (worker_id = auth.uid());

-- Wallet: read-only to the owner; only server-side functions write.
create policy "own wallet readable" on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());

-- Chat: participants only.
create policy "participants read conversations" on public.conversations
  for select to authenticated using (auth.uid() in (participant_a, participant_b));
create policy "start conversation as participant" on public.conversations
  for insert to authenticated with check (auth.uid() in (participant_a, participant_b));
create policy "participants read messages" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and auth.uid() in (c.participant_a, c.participant_b))
  );
create policy "send as self in own conversation" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.participant_a, c.participant_b))
  );
create policy "recipient marks read" on public.messages
  for update to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id and auth.uid() in (c.participant_a, c.participant_b))
  );
