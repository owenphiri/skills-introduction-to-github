\set ON_ERROR_STOP on
\pset pager off

-- Four members, each with 90 days of Nchito income so the affordability gate
-- has something to judge.
do $$
declare i int; u uuid;
begin
  for i in 1..4 loop
    insert into auth.users (id, phone) values (gen_random_uuid(), '+26097000000' || i) returning id into u;
    update public.profiles set full_name = (array['Mercy','Joseph','Naomi','Gilbert'])[i], city = 'Lusaka'
     where id = u;
    insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
    values (u, 'gig_payout', 4000, 'seed income');
  end loop;
end $$;

\echo '--- the gate is closed by default ---'
select public.chilimba_enabled() as enabled;
do $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from public.profiles order by full_name limit 1), true);
  begin
    perform public.create_chilimba('Test', 200, 'monthly', 4);
    raise exception 'SHOULD NOT REACH: a disabled feature created a circle';
  exception when check_violation then
    raise notice 'refused as designed: %', sqlerrm;
  end;
end $$;

\echo '--- open the gate, as an operator holding the licence would ---'
set app.chilimba_enabled = 'true';

\echo '--- affordability: K200/month against K4000 earned ---'
select ok, round(obligation,2) as obligation_90d, round(recent_income,2) as income_90d
  from public.chilimba_affordable((select id from public.profiles order by full_name limit 1), 200, 'monthly');

\echo '--- affordability: K2000/month is refused ---'
select ok, left(reason, 90) as reason
  from public.chilimba_affordable((select id from public.profiles order by full_name limit 1), 2000, 'monthly');

\echo '--- Gilbert creates a 4-person circle, the others join ---'
do $$
declare
  ids uuid[]; code text; cid uuid; i int; msg text;
begin
  select array_agg(id order by full_name) into ids from public.profiles;
  perform set_config('request.jwt.claim.sub', ids[1]::text, true);
  select circle_id, invite_code into cid, code from public.create_chilimba('Soweto Traders', 200, 'monthly', 4);
  raise notice 'circle % created, code %', cid, code;
  for i in 2..4 loop
    perform set_config('request.jwt.claim.sub', ids[i]::text, true);
    select public.join_chilimba(code) into msg;
    raise notice 'member %: %', i, msg;
  end loop;
end $$;

\echo '--- the running order was drawn, and is reproducible from the seed ---'
select m.position, p.full_name
  from public.chilimba_members m join public.profiles p on p.id = m.member_id
 order by m.position;

select c.status, c.current_round, c.order_seed is not null as seed_recorded
  from public.chilimba_circles c;

\echo '--- round 1: three of four pay. Nobody collects a short pot. ---'
do $$
declare ids uuid[]; cid uuid; i int;
begin
  select id into cid from public.chilimba_circles limit 1;
  select array_agg(member_id order by position) into ids from public.chilimba_members where circle_id = cid;
  for i in 1..3 loop
    perform set_config('request.jwt.claim.sub', ids[i]::text, true);
    perform public.chilimba_contribute(cid);
  end loop;
end $$;

select round, paid_count, member_count, recipient_name, outstanding
  from public.chilimba_round_state((select id from public.chilimba_circles limit 1));

select count(*) as payouts_so_far from public.chilimba_payouts;

\echo '--- the fourth pays: the round closes and the pot moves ---'
do $$
declare ids uuid[]; cid uuid;
begin
  select id into cid from public.chilimba_circles limit 1;
  select array_agg(member_id order by position) into ids from public.chilimba_members where circle_id = cid;
  perform set_config('request.jwt.claim.sub', ids[4]::text, true);
  perform public.chilimba_contribute(cid);
end $$;

select p.round, pr.full_name as received_by, p.amount_zmw
  from public.chilimba_payouts p join public.profiles pr on pr.id = p.recipient_id;

select current_round from public.chilimba_circles;

\echo '--- position 1 has collected K800 and paid K200: they cannot walk away ---'
do $$
declare ids uuid[]; cid uuid; msg text;
begin
  select id into cid from public.chilimba_circles limit 1;
  select array_agg(member_id order by position) into ids from public.chilimba_members where circle_id = cid;
  perform set_config('request.jwt.claim.sub', ids[1]::text, true);
  select public.chilimba_leave(cid) into msg;
  raise notice 'leave attempt: %', msg;
end $$;

select round(paid_in,2) as paid_in, round(received,2) as received, round(net,2) as net,
       turn_position, round(exit_cost,2) as exit_cost, may_leave
  from public.chilimba_position((select id from public.chilimba_circles limit 1),
                                (select member_id from public.chilimba_members where position = 1));

\echo '--- position 4 has paid K200 and received nothing: they may leave ---'
select round(paid_in,2) as paid_in, round(received,2) as received, may_leave
  from public.chilimba_position((select id from public.chilimba_circles limit 1),
                                (select member_id from public.chilimba_members where position = 4));

\echo '--- the ledger tells each member which way the money went ---'
select p.full_name, t.kind, t.amount_zmw, t.note
  from public.wallet_transactions t join public.profiles p on p.id = t.user_id
 where t.kind in ('chilimba_in','chilimba_out')
 order by p.full_name, t.created_at;

\echo '--- paying twice in one round is refused ---'
do $$
declare ids uuid[]; cid uuid; msg text;
begin
  select id into cid from public.chilimba_circles limit 1;
  select array_agg(member_id order by position) into ids from public.chilimba_members where circle_id = cid;
  perform set_config('request.jwt.claim.sub', ids[1]::text, true);
  perform public.chilimba_contribute(cid);            -- round 2, legitimate
  select public.chilimba_contribute(cid) into msg;    -- again, must be refused
  raise notice 'second attempt: %', msg;
end $$;
