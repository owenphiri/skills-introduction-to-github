-- Nchito 0012 — language and Chilimba from a feature phone
--
-- Same authorise-by-phone pattern as 0004: the Edge Functions hold the service
-- role key and bypass row level security entirely, so each function re-checks
-- who is asking and every one of them is revoked from anon and authenticated.
--
-- The reason this matters more here than anywhere else: someone whose only way
-- into Nchito is a USSD shortcode is also, usually, the person least able to
-- absorb losing money to a bug. Feature-phone parity is not a courtesy.

-- ============================================================
-- The PIN check, in one place
-- ============================================================
-- 0004 does this inline inside channel_cash_out. Copying it for the chilimba
-- path would mean two implementations of a lock-out, and the second one is
-- always the one that quietly loses a rule. Extracted here and left in place
-- there, because a migration that has run is history: 0004 keeps its copy, and
-- everything from here on uses this.
--
-- Returns a reason on failure and null on success, so a caller cannot mistake
-- a refusal for a pass by forgetting to negate something.
create or replace function public.channel_pin_problem(p_user uuid, p_pin text)
returns text
language plpgsql security definer set search_path = public
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = p_user;
  if not found then return 'You are not registered on Nchito.'; end if;

  if me.channel_locked_until is not null and me.channel_locked_until > now() then
    return 'Too many wrong PINs. Try again in 30 minutes.';
  end if;
  if me.channel_pin_hash is null then
    return 'Set a PIN in the Nchito app before moving money from your phone.';
  end if;
  if extensions.crypt(p_pin, me.channel_pin_hash) <> me.channel_pin_hash then
    -- Counted on the profile rather than in the session, so closing the USSD
    -- call and dialling again cannot reset the count.
    update public.profiles
       set channel_locked_until = case
             when channel_locked_until is null then now() + interval '2 minutes'
             else now() + interval '30 minutes' end
     where id = me.id;
    return 'Wrong PIN.';
  end if;

  update public.profiles set channel_locked_until = null where id = me.id;
  return null;
end;
$$;

-- ============================================================
-- Language
-- ============================================================
create or replace function public.channel_set_language(p_phone text, p_language text)
returns text
language plpgsql security definer set search_path = public
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where phone = p_phone;
  if not found then return 'Not registered.'; end if;
  if p_language !~ '^[a-z]{2,3}$' then return 'Unknown language.'; end if;

  update public.profiles set language = p_language where id = me.id;
  return 'ok';
end;
$$;

create or replace function public.channel_language(p_phone text)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select language from public.profiles where phone = p_phone), 'en');
$$;

-- ============================================================
-- Chilimba
-- ============================================================
-- Reading is allowed whatever the gate says, so a member can always see where
-- they stand. Paying in is not: that moves money, and moving money is the part
-- that needs authorisation.
create or replace function public.channel_my_chilimbas(p_phone text)
returns table (
  circle_id     uuid,
  name          text,
  contribution  numeric,
  status        chilimba_status,
  current_round int,
  my_position   int,
  paid_this_round boolean,
  net           numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare me public.profiles;
begin
  select * into me from public.profiles where phone = p_phone;
  if not found then return; end if;

  return query
  select c.id, c.name, c.contribution_zmw, c.status, c.current_round, m.position,
         exists (select 1 from public.chilimba_contributions k
                  where k.circle_id = c.id and k.round = c.current_round
                    and k.member_id = me.id),
         coalesce((select sum(amount_zmw) from public.chilimba_contributions k
                    where k.circle_id = c.id and k.member_id = me.id), 0)
         - coalesce((select sum(amount_zmw) from public.chilimba_payouts y
                      where y.circle_id = c.id and y.recipient_id = me.id), 0)
    from public.chilimba_members m
    join public.chilimba_circles c on c.id = m.circle_id
   where m.member_id = me.id and m.status = 'active'
   order by c.created_at desc;
end;
$$;

-- Paying in from a handset needs the PIN, exactly like cash-out does. A USSD
-- session can be left open on a borrowed phone, and a contribution is money
-- leaving the wallet.
create or replace function public.channel_chilimba_contribute(
  p_phone text, p_circle uuid, p_pin text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  me       public.profiles;
  v_circle public.chilimba_circles%rowtype;
  v_bal    numeric;
  v_problem text;
begin
  if not public.chilimba_enabled() then
    return 'Chilimba is not switched on yet.';
  end if;

  select * into me from public.profiles where phone = p_phone;
  if not found then return 'You are not registered on Nchito.'; end if;

  v_problem := public.channel_pin_problem(me.id, p_pin);
  if v_problem is not null then return v_problem; end if;

  select * into v_circle from public.chilimba_circles where id = p_circle;
  if not found or v_circle.status <> 'active' then return 'That circle is not running.'; end if;

  if not exists (select 1 from public.chilimba_members
                  where circle_id = p_circle and member_id = me.id and status = 'active') then
    return 'You are not a member of that circle.';
  end if;

  if exists (select 1 from public.chilimba_contributions
              where circle_id = p_circle and round = v_circle.current_round
                and member_id = me.id) then
    return 'You have already paid for this round.';
  end if;

  v_bal := public.wallet_balance(me.id);
  if v_bal < v_circle.contribution_zmw then
    return 'Not enough in your wallet. You need K' ||
           to_char(v_circle.contribution_zmw, 'FM999999990') || '.';
  end if;

  insert into public.chilimba_contributions (circle_id, round, member_id, amount_zmw, source)
  values (p_circle, v_circle.current_round, me.id, v_circle.contribution_zmw, 'wallet');

  insert into public.wallet_transactions (user_id, kind, amount_zmw, note)
  values (me.id, 'chilimba_in', -v_circle.contribution_zmw,
          v_circle.name || ' - round ' || v_circle.current_round);

  perform public.chilimba_settle_round(p_circle);

  return 'Paid K' || to_char(v_circle.contribution_zmw, 'FM999999990') ||
         ' into ' || v_circle.name || '.';
end;
$$;

-- ============================================================
-- Never reachable except through an Edge Function
-- ============================================================
revoke execute on function public.channel_pin_problem(uuid, text) from anon, authenticated;
revoke execute on function public.channel_set_language(text, text) from anon, authenticated;
revoke execute on function public.channel_language(text) from anon, authenticated;
revoke execute on function public.channel_my_chilimbas(text) from anon, authenticated;
revoke execute on function public.channel_chilimba_contribute(text, uuid, text) from anon, authenticated;
