#!/usr/bin/env bash
# Checks that every RPC and table the clients reference actually exists.
#
# Nothing in this repository except the SQL and the web app can be compiled in
# CI, so a Swift or Kotlin call to a function that was renamed — or never
# written — would go unnoticed until someone opened Xcode. This closes that gap
# by reading the names out of a database that has had every migration applied.
#
#   nchito-ios/supabase/test/run.sh     # leaves the cluster running
#   nchito-ios/supabase/test/crosscheck.sh
set -uo pipefail

PORT=${PORT:-5433}
SOCK=${SOCK:-/var/tmp}
AS_PG=${AS_PG:-postgres}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/../../.."

q() { su "$AS_PG" -c "psql -h $SOCK -p $PORT -U postgres -tAc \"$1\""; }

FUNCS=$(q "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'" | sort -u)
TABLES=$(q "select table_name from information_schema.tables where table_schema='public'" | sort -u)

if [ -z "$FUNCS" ]; then
  echo "No database on port $PORT. Run nchito-ios/supabase/test/run.sh first." >&2
  exit 1
fi

fail=0

# RPC names as the clients spell them. Matched across newlines, because a call
# whose arguments wrap to the next line is exactly as real as one that does not
# — an earlier version of this script missed two functions for that reason.
CALLED=$(
  grep -rzohP 'rpc\(\s*"[a-z_]+"' \
    "$ROOT/nchito-ios/Nchito" "$ROOT/nchito-android/app/src" "$ROOT/nchito-ios/supabase/functions" \
    2>/dev/null | tr '\0' '\n' | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u
)

echo "== RPCs the clients call =="
for fn in $CALLED; do
  if grep -qx "$fn" <<<"$FUNCS"; then
    printf '  ok      %s\n' "$fn"
  else
    fail=1; printf '  MISSING %s  <- called but not defined in any migration\n' "$fn"
  fi
done

# Tables named in PostgREST paths.
echo
echo "== tables the clients read or write =="
# Anchored on the API client, not on any method called get/insert/update —
# `count("id")` in unrelated code is not a table reference.
TOUCHED=$(
  grep -rzohP 'api\.(get|insert|update)\(\s*"[a-z_]+"' \
    "$ROOT/nchito-ios/Nchito" "$ROOT/nchito-android/app/src" 2>/dev/null \
    | tr '\0' '\n' | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u
)
for tb in $TOUCHED; do
  if grep -qx "$tb" <<<"$TABLES"; then
    printf '  ok      %s\n' "$tb"
  else
    fail=1; printf '  MISSING %s  <- referenced but no such table\n' "$tb"
  fi
done

echo
if [ "$fail" -ne 0 ]; then echo "Cross-check FAILED."; exit 1; fi
echo "Every RPC and table the clients reference exists."
