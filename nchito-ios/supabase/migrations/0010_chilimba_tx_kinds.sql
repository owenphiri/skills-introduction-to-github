-- Nchito 0010 — wallet transaction kinds for the Chilimba
--
-- Split from 0011 for the same reason 0007 is split from 0008: Postgres will
-- not let a new enum value be USED in the transaction that created it. Apply
-- this, let it commit, then apply 0011.
--
-- Two kinds, because a chilimba moves money in both directions and a ledger
-- that calls both "transfer" tells a member nothing about whether this was
-- their turn or their turn to pay.

alter type tx_kind add value if not exists 'chilimba_in';
alter type tx_kind add value if not exists 'chilimba_out';
