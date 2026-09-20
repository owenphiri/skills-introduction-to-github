\set ON_ERROR_STOP on
\pset pager off
set app.chilimba_enabled = 'true';
select set_config('app.settings.work_record_secret', 'test-secret-not-for-production-0123456789', false);

-- A poster and a worker who is mid-circle with auto-contribute switched on.
do $$
declare poster uuid; worker uuid; gig uuid; cid uuid; code text; o uuid; i int;
begin
  insert into auth.users (id, phone) values (gen_random_uuid(), '+260970001001') returning id into poster;
  insert into auth.users (id, phone) values (gen_random_uuid(), '+260970001002') returning id into worker;
  update public.profiles set full_name = 'Poster Co' where id = poster;
  update public.profiles set full_name = 'Worker One' where id = worker;

  -- Income so the affordability gate has something to work with.
  insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
  values (worker, 'gig_payout', 5000, 'seed');

  -- A live 3-person circle the worker belongs to.
  perform set_config('request.jwt.claim.sub', worker::text, true);
  select circle_id, invite_code into cid, code from public.create_chilimba('Payout Circle', 100, 'monthly', 3);
  for i in 1..2 loop
    insert into auth.users (id, phone) values (gen_random_uuid(), '+26097000200' || i) returning id into o;
    insert into public.wallet_transactions (user_id, kind, amount_zmw, note) values (o, 'gig_payout', 5000, 'seed');
    perform set_config('request.jwt.claim.sub', o::text, true);
    perform public.join_chilimba(code);
  end loop;

  perform set_config('request.jwt.claim.sub', worker::text, true);
  update public.chilimba_members set auto_contribute = true
   where circle_id = cid and member_id = worker;

  -- A gig, worked and photographed.
  perform set_config('request.jwt.claim.sub', poster::text, true);
  insert into public.gigs (poster_id, title, details, category, pay_zmw, city, area, status, assigned_worker)
  values (poster, 'Paint the shop front', 'Two coats.', 'painting', 1000, 'Lusaka', 'Kabwata', 'completed', worker)
  returning id into gig;

  insert into public.proof_of_work (gig_id, worker_id, kind, storage_path, captured_at)
  values (gig, worker, 'before', 'proofs/a.jpg', now() - interval '2 hours'),
         (gig, worker, 'after',  'proofs/b.jpg', now());

  perform public.release_escrow(gig);
  raise notice 'escrow released on gig %', gig;
end $$;

\echo '--- the worker''s ledger: payout in, circle contribution out ---'
select t.kind, t.amount_zmw, t.note
  from public.wallet_transactions t join public.profiles p on p.id = t.user_id
 where p.full_name = 'Worker One' and t.kind <> 'gig_payout'
 order by t.created_at;

\echo '--- the contribution was recorded as coming from the payout, not the wallet ---'
select round, amount_zmw, source from public.chilimba_contributions
 where circle_id = (select id from public.chilimba_circles where name = 'Payout Circle');

\echo '--- balance = 5000 seed + 900 payout (10% fee) - 100 contribution ---'
select round(public.wallet_balance((select id from public.profiles where full_name = 'Worker One')), 2) as balance;

\echo '--- the gig is paid and on the Work Record ---'
select g.status, w.title, w.pay_zmw, w.on_time, length(w.signature) as signature_len
  from public.gigs g join public.work_records w on w.gig_id = g.id
 where g.title = 'Paint the shop front';

\echo '--- with the gate shut, escrow release still works and simply skips the circle ---'
set app.chilimba_enabled = 'false';
do $$
declare poster uuid; worker uuid; gig uuid;
begin
  select id into worker from public.profiles where full_name = 'Worker One';
  select id into poster from public.profiles where full_name = 'Poster Co';
  perform set_config('request.jwt.claim.sub', poster::text, true);
  insert into public.gigs (poster_id, title, details, category, pay_zmw, city, area, status, assigned_worker)
  values (poster, 'Second job', 'More work.', 'painting', 500, 'Lusaka', 'Kabwata', 'completed', worker)
  returning id into gig;
  insert into public.proof_of_work (gig_id, worker_id, kind, storage_path, captured_at)
  values (gig, worker, 'before', 'proofs/c.jpg', now()), (gig, worker, 'after', 'proofs/d.jpg', now());
  perform public.release_escrow(gig);
  raise notice 'second release fine with chilimba disabled';
end $$;
select count(*) as contributions_still from public.chilimba_contributions;

\echo '--- voice notes: a gig recorded rather than typed ---'
set app.chilimba_enabled = 'true';
do $$
declare worker uuid; gig uuid;
begin
  select id into worker from public.profiles where full_name = 'Worker One';
  select id into gig from public.gigs where title = 'Second job';
  perform set_config('request.jwt.claim.sub', worker::text, true);
  insert into public.voice_notes (author_id, subject, subject_id, storage_path, duration_secs, language)
  values (worker, 'gig', gig, 'voice/' || gig || '.webm', 23.5, 'ny');
end $$;

select subject, duration_secs, language, transcript is null as transcript_is_null, corpus_consent
  from public.voice_notes;

\echo '--- a voice note cannot be re-pointed at another gig after the fact ---'
do $$
declare n uuid; other uuid;
begin
  select id into n from public.voice_notes limit 1;
  select id into other from public.gigs where title = 'Paint the shop front';
  begin
    update public.voice_notes set subject_id = other where id = n;
    raise exception 'SHOULD NOT REACH: a voice note was re-pointed';
  exception when others then
    raise notice 'refused as designed: %', sqlerrm;
  end;
  -- Consent is the one thing the author may change.
  update public.voice_notes set corpus_consent = true where id = n;
  raise notice 'consent toggled fine';
end $$;

\echo '--- the taxonomy and its metadata agree ---'
select count(*) as drift_rows from public.taxonomy_drift();
