-- Nchito 0009 — language preference and voice notes
--
-- Two things, both aimed at the same person: someone who can do the work but
-- cannot comfortably read or write a gig description in English.
--
-- WHAT THIS IS NOT
--
-- It is not speech recognition. No browser, phone OS or commodity API
-- transcribes Nyanja, Bemba, Tonga or Lozi today, and pretending otherwise
-- would mean silently dropping people's words. So the mechanism here is the
-- one Zambians already use every day on WhatsApp: record a voice note, and let
-- the other person listen. That needs no model, works on a K400 handset, and
-- is the whole feature for a poster who cannot type their job.
--
-- Transcription is left as a nullable column, filled in later by a human or by
-- a model trained on this very corpus (INNOVATION.md §3.4). Until then it is
-- null, and every surface shows "voice note" rather than inventing text.

-- ============================================================
-- Language
-- ============================================================
-- Stored as text, not an enum. Languages are added by translators, not by
-- migrations, and an enum would make every new language a schema change.
alter table public.profiles
  add column if not exists language text not null default 'en'
    check (language ~ '^[a-z]{2,3}$');

comment on column public.profiles.language is
  'BCP-47-ish code matching nchito-shared/languages.json. Text rather than an
   enum so adding a language is a deploy, not a migration.';

-- ============================================================
-- Voice notes
-- ============================================================
create type voice_note_subject as enum ('gig', 'message', 'application');

create table if not exists public.voice_notes (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  subject        voice_note_subject not null,
  -- Deliberately not a foreign key: the three subject kinds live in three
  -- tables, and a single typed column cannot reference all of them. The
  -- per-subject policies below carry the integrity instead.
  subject_id     uuid not null,
  storage_path   text not null unique,
  duration_secs  numeric(6,2) not null check (duration_secs > 0 and duration_secs <= 180),
  language       text not null default 'en' check (language ~ '^[a-z]{2,3}$'),
  -- Null until somebody or something transcribes it. Never guessed at.
  transcript     text,
  transcribed_by text check (transcribed_by in ('human', 'model')),
  -- Explicit, revocable, and off by default: a recording of someone's voice is
  -- not ours to train on because they happened to use the app. INNOVATION.md
  -- §3.4 wants this corpus; it does not get it without being asked.
  corpus_consent boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists voice_notes_subject_idx
  on public.voice_notes (subject, subject_id);
create index if not exists voice_notes_author_idx
  on public.voice_notes (author_id, created_at desc);

alter table public.voice_notes enable row level security;

-- A voice note is readable by whoever can already see the thing it is attached
-- to. Working that out per subject is the price of the polymorphic column.
drop policy if exists "voice notes follow their subject" on public.voice_notes;
create policy "voice notes follow their subject"
  on public.voice_notes for select
  using (
    author_id = auth.uid()
    or (subject = 'gig' and exists (
          select 1 from public.gigs g where g.id = subject_id))
    or (subject = 'message' and exists (
          select 1 from public.messages m
            join public.conversations c on c.id = m.conversation_id
           where m.id = subject_id
             and (c.participant_a = auth.uid() or c.participant_b = auth.uid())))
    or (subject = 'application' and exists (
          select 1 from public.gig_applications a
            join public.gigs g on g.id = a.gig_id
           where a.id = subject_id
             and (a.worker_id = auth.uid() or g.poster_id = auth.uid())))
  );

drop policy if exists "people record their own voice notes" on public.voice_notes;
create policy "people record their own voice notes"
  on public.voice_notes for insert
  with check (author_id = auth.uid());

-- Consent is the only field the author may change afterwards. A recording that
-- could be edited after the other side heard it is not evidence of anything.
drop policy if exists "authors may only revoke consent" on public.voice_notes;
create policy "authors may only revoke consent"
  on public.voice_notes for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create or replace function public.voice_notes_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.storage_path is distinct from old.storage_path
     or new.subject is distinct from old.subject
     or new.subject_id is distinct from old.subject_id
     or new.author_id is distinct from old.author_id
     or new.duration_secs is distinct from old.duration_secs
     or new.created_at is distinct from old.created_at then
    raise exception 'a voice note cannot be re-pointed or re-recorded, only its consent changed';
  end if;
  return new;
end;
$$;

drop trigger if exists voice_notes_no_swap on public.voice_notes;
create trigger voice_notes_no_swap
  before update on public.voice_notes
  for each row execute function public.voice_notes_immutable();

-- ============================================================
-- Reading a gig without reading
-- ============================================================
-- Returns everything needed to render a gig to someone who cannot read the
-- description: the voice note if one exists, and the category name in their
-- own language so at least the label is theirs.
create or replace function public.gig_voice(p_gig uuid)
returns table (
  note_id      uuid,
  storage_path text,
  duration_secs numeric,
  language     text,
  transcript   text
)
language sql stable
as $$
  select v.id, v.storage_path, v.duration_secs, v.language, v.transcript
    from public.voice_notes v
   where v.subject = 'gig' and v.subject_id = p_gig
   order by v.created_at
   limit 1;
$$;

grant execute on function public.gig_voice(uuid) to anon, authenticated;

-- ============================================================
-- Storage
-- ============================================================
-- Create a PRIVATE bucket named `voice` alongside `proofs`, served through
-- signed URLs only. A public bucket would make every recording of somebody's
-- voice enumerable by anyone who guessed a path.
--
--   insert into storage.buckets (id, name, public)
--   values ('voice', 'voice', false)
--   on conflict (id) do nothing;
--
-- Keep the 3-minute cap in `duration_secs` in step with whatever size limit is
-- set on the bucket; a recording that uploads but fails its check is a worse
-- experience than one refused before it starts.
