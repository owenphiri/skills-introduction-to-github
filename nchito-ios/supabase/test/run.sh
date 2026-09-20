#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL cluster and runs the tests.
#
# Until this existed, none of the SQL in this project had ever been executed —
# it was verified by reading. The first run found two migrations that could not
# have been applied to any database at all:
#
#   · 0006 `city_centre` selected three columns while declaring two, which
#     Postgres rejects at CREATE FUNCTION time.
#   · 0009 referenced conversations.poster_id, a column that does not exist.
#
# Neither is the kind of thing careful reading catches, which is the argument
# for this file.
#
#   sudo apt-get install -y postgresql-16     # or any 14+
#   nchito-ios/supabase/test/run.sh
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA_DIR=${PGDATA_DIR:-/var/tmp/nchito-pg-test}
PORT=${PORT:-5433}
SOCK=${SOCK:-/var/tmp}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../migrations"
AS_PG=${AS_PG:-postgres}

run() { su "$AS_PG" -c "$1"; }

echo "==> fresh cluster in $PGDATA_DIR"
run "$PGBIN/pg_ctl -D $PGDATA_DIR -m immediate stop" >/dev/null 2>&1 || true
# Another cluster on the same port leaves a socket behind and the start fails
# with a message about a lock file, which says nothing about what to do.
if [ -e "$SOCK/.s.PGSQL.$PORT" ]; then
  echo "Something is already listening on $SOCK/.s.PGSQL.$PORT." >&2
  echo "Stop it, or re-run with PORT=5434." >&2
  exit 1
fi
rm -rf "$PGDATA_DIR"; mkdir -p "$PGDATA_DIR"
chown "$AS_PG:$AS_PG" "$PGDATA_DIR"; chmod 700 "$PGDATA_DIR"
run "$PGBIN/initdb -D $PGDATA_DIR -U postgres --auth=trust" >/dev/null
run "$PGBIN/pg_ctl -D $PGDATA_DIR -o '-k $SOCK -p $PORT -c listen_addresses=' -l $PGDATA_DIR/log start" >/dev/null
sleep 2

psql_run() {
  # Copied to a world-readable path first: the postgres user cannot read a
  # checkout under someone's home directory.
  cp "$1" /var/tmp/_nchito_run.sql
  run "psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 ${2:-} -f /var/tmp/_nchito_run.sql"
}

echo "==> Supabase shim (auth.uid, roles, storage.buckets)"
psql_run "$HERE/00_supabase_shim.sql" "-q" >/dev/null
run "psql -h $SOCK -p $PORT -U postgres -q -c 'create publication supabase_realtime;'" >/dev/null 2>&1

echo "==> migrations"
fail=0
for f in "$MIGRATIONS"/*.sql; do
  # One transaction each, which is also how they must be applied for real:
  # 0007 and 0010 create enum values that 0008 and 0011 then use, and Postgres
  # forbids that inside a single transaction.
  if out=$(psql_run "$f" "--single-transaction -q" 2>&1); then
    printf '  OK    %s\n' "$(basename "$f")"
  else
    fail=1; printf '  FAIL  %s\n%s\n' "$(basename "$f")" "$(echo "$out" | grep -v NOTICE | head -8)"
  fi
done
[ "$fail" -eq 0 ] || { echo "migrations failed"; exit 1; }

echo "==> tests"
for f in "$HERE"/[0-9][0-9]_*.sql; do
  case "$(basename "$f")" in 00_*) continue;; esac
  echo "--- $(basename "$f")"
  psql_run "$f"
done

echo
echo "All migrations applied and all tests ran."
echo "Stop the cluster with: $PGBIN/pg_ctl -D $PGDATA_DIR stop"
