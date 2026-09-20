-- Nchito 0008 — group metadata for the service taxonomy
--
-- Requires 0007 to have COMMITTED first: this migration casts the new enum
-- values to gig_category, which Postgres refuses inside the transaction that
-- created them.
--
-- Why a table and not just client-side constants: a poster on USSD, a worker on
-- Android and an analyst running SQL all need the same grouping, and the
-- USSD/WhatsApp Edge Functions bypass RLS, so they need a server-side answer
-- they can trust. The clients still carry generated copies for offline use;
-- taxonomy_drift() below is what catches them disagreeing.
--
-- Source of truth: nchito-shared/taxonomy.json.

create table if not exists public.service_groups (
  code       text primary key,
  label      text not null,
  blurb      text not null default '',
  emoji      text not null default '',
  sort_order int  not null
);

create table if not exists public.service_categories (
  code       gig_category primary key,
  group_code text not null references public.service_groups(code) on update cascade,
  label      text not null,
  short      text not null,
  emoji      text not null default '',
  sort_order int  not null,
  -- A short label has to survive a 182-character USSD screen shared with five
  -- other lines. Enforced here so a well-meaning edit in the dashboard cannot
  -- quietly break the feature-phone menu.
  constraint service_categories_short_fits_ussd check (length(short) <= 16)
);

create index if not exists service_categories_group_idx
  on public.service_categories (group_code, sort_order);

insert into public.service_groups (code, label, blurb, emoji, sort_order) values
  ('trades', 'Building & Trades', 'The people who build and fix the physical thing.', '🧱', 1),
  ('home', 'Home & Care', 'Work inside someone''s home, and the people in it.', '🏡', 2),
  ('food', 'Food & Hospitality', 'Cooking, serving and feeding a room.', '🍲', 3),
  ('logistics', 'Transport & Errands', 'Moving things and people across town.', '🛵', 4),
  ('style', 'Style & Lifestyle', 'Hair, clothes, skin and looking after yourself.', '✂️', 5),
  ('creative', 'Creative & Media', 'Design, sound, pictures and the web.', '🎨', 6),
  ('learning', 'Learning & Guidance', 'Teaching, coaching and counsel.', '📚', 7),
  ('office', 'Office & Admin', 'The paperwork behind a small business.', '🗂️', 8)
on conflict (code) do update
  set label = excluded.label, blurb = excluded.blurb,
      emoji = excluded.emoji, sort_order = excluded.sort_order;

insert into public.service_categories (code, group_code, label, short, emoji, sort_order) values
  ('bricklaying', 'trades', 'Bricklaying & Masonry', 'Bricklaying', '🧱', 1),
  ('carpentry', 'trades', 'Carpentry & Joinery', 'Carpentry', '🪚', 2),
  ('painting', 'trades', 'Painting & Decorating', 'Painting', '🖌️', 3),
  ('welding', 'trades', 'Welding & Metalwork', 'Welding', '🔥', 4),
  ('plumbing', 'trades', 'Plumbing', 'Plumbing', '🚰', 5),
  ('electrical', 'trades', 'Electrical Services', 'Electrical', '⚡', 6),
  ('repairs', 'trades', 'Repairs & Technical', 'Repairs', '🔧', 7),
  ('home_services', 'home', 'Home Services', 'Home help', '🏠', 8),
  ('cleaning', 'home', 'Cleaning', 'Cleaning', '🧹', 9),
  ('laundry', 'home', 'Washing & Ironing', 'Washing', '👕', 10),
  ('security', 'home', 'Security & Guarding', 'Security', '🛡️', 11),
  ('childcare', 'home', 'Childcare & Nannies', 'Childcare', '👶', 12),
  ('farm', 'home', 'Farm & Garden', 'Farm/garden', '🌱', 13),
  ('catering', 'food', 'Catering', 'Catering', '🍽️', 14),
  ('chef', 'food', 'Chefs & Cooks', 'Chef/cook', '👨‍🍳', 15),
  ('restaurant', 'food', 'Restaurant & Bar Work', 'Restaurant', '🍽️', 16),
  ('events', 'food', 'Events & Functions', 'Events', '🎉', 17),
  ('delivery', 'logistics', 'Delivery & Errands', 'Delivery', '🛵', 18),
  ('messenger', 'logistics', 'Messengers', 'Messenger', '✉️', 19),
  ('loading', 'logistics', 'Loading & Moving', 'Loading', '📦', 20),
  ('driving', 'logistics', 'Driving', 'Driving', '🚗', 21),
  ('beauty', 'style', 'Beauty & Grooming', 'Beauty', '💅', 22),
  ('barbering', 'style', 'Barbershops', 'Barbering', '💈', 23),
  ('salon', 'style', 'Salon & Hair', 'Salon', '💇‍♀️', 24),
  ('cosmetics', 'style', 'Cosmetics & Make-up', 'Cosmetics', '💄', 25),
  ('tailoring', 'style', 'Sewing & Tailoring', 'Sewing', '🧵', 26),
  ('lifestyle', 'style', 'Lifestyle & Wellness', 'Lifestyle', '🧘', 27),
  ('digital', 'creative', 'Digital & Design', 'Design', '💻', 28),
  ('web_design', 'creative', 'Web Design & Dev', 'Web design', '🌐', 29),
  ('music', 'creative', 'Music & Sound', 'Music', '🎵', 30),
  ('photography', 'creative', 'Photo & Video', 'Photo/video', '📷', 31),
  ('tutoring', 'learning', 'Tutoring & Lessons', 'Tutoring', '📖', 32),
  ('teaching', 'learning', 'Teaching Services', 'Teaching', '🎓', 33),
  ('coaching', 'learning', 'Coaching & Training', 'Coaching', '🏃', 34),
  ('counselling', 'learning', 'Counselling', 'Counselling', '🫂', 35),
  ('ministry', 'learning', 'Preaching & Ministry', 'Ministry', '🙏', 36),
  ('office_admin', 'office', 'Office & Admin Support', 'Office admin', '🗂️', 37),
  ('bookkeeping', 'office', 'Bookkeeping & Accounts', 'Bookkeeping', '📒', 38),
  ('translation', 'office', 'Translation & Typing', 'Translation', '🗣️', 39)
on conflict (code) do update
  set group_code = excluded.group_code, label = excluded.label, short = excluded.short,
      emoji = excluded.emoji, sort_order = excluded.sort_order;

-- ============================================================
-- Reference data: readable by anyone, writable by nobody through the API.
-- ============================================================
alter table public.service_groups     enable row level security;
alter table public.service_categories enable row level security;

drop policy if exists "service groups are public" on public.service_groups;
create policy "service groups are public"
  on public.service_groups for select using (true);

drop policy if exists "service categories are public" on public.service_categories;
create policy "service categories are public"
  on public.service_categories for select using (true);

grant select on public.service_groups, public.service_categories to anon, authenticated;

-- ============================================================
-- The whole catalog in one round trip, ordered for display.
-- ============================================================
create or replace function public.service_catalog()
returns table (
  category    gig_category,
  cat_label   text,
  cat_short   text,
  cat_emoji   text,
  group_code  text,
  group_label text,
  group_blurb text,
  group_emoji text
)
language sql stable
as $$
  select c.code, c.label, c.short, c.emoji,
         g.code, g.label, g.blurb, g.emoji
    from public.service_categories c
    join public.service_groups g on g.code = c.group_code
   order by g.sort_order, c.sort_order;
$$;

grant execute on function public.service_catalog() to anon, authenticated;

-- ============================================================
-- Drift guard
-- ============================================================
-- The enum and this table are two lists of the same thing, so they can
-- disagree: someone adds an enum value in a later migration and forgets the
-- metadata, and the category then renders as a blank chip on every client.
-- This returns the disagreement rather than hiding it. Run it after any
-- taxonomy change, alongside `node nchito-shared/generate.mjs --check`.
create or replace function public.taxonomy_drift()
returns table (code text, problem text)
language sql stable
as $$
  select e.enumlabel::text, 'enum value has no row in service_categories'
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid and t.typname = 'gig_category'
   where not exists (
     select 1 from public.service_categories c where c.code::text = e.enumlabel
   )
  union all
  select c.code::text, 'metadata row has no matching enum value'
    from public.service_categories c
   where not exists (
     select 1 from pg_enum e
       join pg_type t on t.oid = e.enumtypid and t.typname = 'gig_category'
      where e.enumlabel = c.code::text
   );
$$;

grant execute on function public.taxonomy_drift() to authenticated;
