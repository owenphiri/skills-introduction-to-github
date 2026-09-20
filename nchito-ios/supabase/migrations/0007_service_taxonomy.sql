-- Nchito 0007 — widen the service taxonomy from 8 categories to 39
--
-- Zambian informal work is not eight things. A bricklayer, a tailor, a chef and
-- a preacher were each filed under whichever of the original eight fitted
-- worst, which made the feed unsearchable and the price bands meaningless:
-- comparing a plumbing job against "home services" tells a poster nothing.
--
-- This file does ONE thing: add the enum values. Postgres will not let a new
-- enum value be USED in the same transaction that created it, so the group
-- metadata that references these codes lives in 0008 and must be applied only
-- after this migration has committed. Apply the two separately, in order.
--
-- "if not exists" makes a re-run safe: a half-applied migration can simply be
-- run again instead of being picked apart by hand.
--
-- Source of truth: nchito-shared/taxonomy.json.

alter type gig_category add value if not exists 'bricklaying';
alter type gig_category add value if not exists 'carpentry';
alter type gig_category add value if not exists 'painting';
alter type gig_category add value if not exists 'welding';
alter type gig_category add value if not exists 'plumbing';
alter type gig_category add value if not exists 'electrical';
alter type gig_category add value if not exists 'cleaning';
alter type gig_category add value if not exists 'laundry';
alter type gig_category add value if not exists 'security';
alter type gig_category add value if not exists 'childcare';
alter type gig_category add value if not exists 'catering';
alter type gig_category add value if not exists 'chef';
alter type gig_category add value if not exists 'restaurant';
alter type gig_category add value if not exists 'messenger';
alter type gig_category add value if not exists 'loading';
alter type gig_category add value if not exists 'driving';
alter type gig_category add value if not exists 'barbering';
alter type gig_category add value if not exists 'salon';
alter type gig_category add value if not exists 'cosmetics';
alter type gig_category add value if not exists 'tailoring';
alter type gig_category add value if not exists 'lifestyle';
alter type gig_category add value if not exists 'web_design';
alter type gig_category add value if not exists 'music';
alter type gig_category add value if not exists 'photography';
alter type gig_category add value if not exists 'teaching';
alter type gig_category add value if not exists 'coaching';
alter type gig_category add value if not exists 'counselling';
alter type gig_category add value if not exists 'ministry';
alter type gig_category add value if not exists 'office_admin';
alter type gig_category add value if not exists 'bookkeeping';
alter type gig_category add value if not exists 'translation';
