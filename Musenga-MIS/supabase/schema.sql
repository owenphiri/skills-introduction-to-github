-- Musenga MIS — Supabase schema
--
-- Scope: this backs ONLY the AI usage/telemetry layer (api/_lib/usage.js).
-- It is deliberately NOT a migration of the app's existing data (students,
-- grades, attendance, etc.) — that stays in each device's IndexedDB, as it
-- does today. This schema exists so the AI layer is multi-tenant-ready from
-- day one (every row is scoped by school_id) without having to build a
-- school-onboarding flow now: only Musenga is seeded below, and adding a
-- second school later is a single INSERT plus a new schoolId value passed
-- from the frontend — no schema change.
--
-- Run this once in the Supabase SQL editor (or `supabase db push`) after
-- creating a project. See Musenga-MIS/docs/DEPLOYMENT.md for how the
-- SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars connect this to the
-- Vercel deployment. Everything here is optional — the AI features work
-- without Supabase configured; usage just won't be logged.

create table if not exists schools (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into schools (id, name)
values ('musenga', 'Musenga Day Secondary School')
on conflict (id) do nothing;

create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  school_id text not null references schools(id),
  endpoint text not null,       -- e.g. "scheme-of-work", "lesson-plan", "quiz", "coding-tutor"
  role text,                    -- the requesting user's app role, for rough usage breakdown
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_school_id_idx on ai_usage (school_id);
create index if not exists ai_usage_created_at_idx on ai_usage (created_at);

-- RLS is enabled even though only the service-role key (used by the Vercel
-- API layer, never exposed to the browser) writes here today — this is the
-- tenant-isolation boundary a future per-school anon/read policy would
-- attach to, so it exists now rather than being retrofitted later.
alter table schools enable row level security;
alter table ai_usage enable row level security;

-- The service role bypasses RLS entirely (used by api/_lib/usage.js), so
-- no INSERT policy is required for the app to work. These SELECT policies
-- just mean "no anonymous/public read access" until a real per-school
-- policy is designed alongside actual school-onboarding.
drop policy if exists "no public read" on schools;
create policy "no public read" on schools for select using (false);
drop policy if exists "no public read" on ai_usage;
create policy "no public read" on ai_usage for select using (false);
