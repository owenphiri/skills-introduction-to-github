# VoltexAI × Supabase

VoltexAI uses **Supabase purely as its managed Postgres database** for the FastAPI
API. The web/mobile clients never talk to Supabase directly — they call the API,
which is the trusted gatekeeper (JWT auth + plan/role checks).

**Security:** Supabase auto-exposes the `public` schema through its anon PostgREST
API, so `schema.sql` enables **deny-all RLS** (RLS on, no policies) on every table —
this blocks the anon API completely, while the API's privileged `postgres` connection
bypasses RLS and works unchanged. Add policies only if you deliberately use Supabase's
data API directly.

## Connect in 3 steps

1. **Create a project** at [supabase.com](https://supabase.com) (or via the Supabase
   MCP `create_project`).
2. **Grab the connection string** — Dashboard → *Project Settings → Database →
   Connection string → URI*. Use the **Session pooler** (port `5432`) or the direct
   connection for SQLAlchemy (avoid the transaction pooler on `6543` for the API).
3. **Set it on the API** (Render / Docker / your host):
   ```
   DATABASE_URL=postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres
   ```
   The backend automatically normalises a `postgres://` scheme and adds
   `sslmode=require`, so the raw Supabase URI works as-is.

## Schema

The API **auto-creates all tables on boot** (`init_db`), so no manual step is needed.
If you prefer SQL-first (or want to add indexes/policies), apply
[`schema.sql`](./schema.sql):

```bash
psql "$DATABASE_URL" -f schema.sql
# or Supabase Dashboard → SQL Editor → paste → Run
# or Supabase MCP → apply_migration(name="voltexai_initial_schema", query=<schema.sql>)
```

## Notes

- **Backups & PITR:** enable in the Supabase dashboard for production.
- **Connection pooling:** the API pool is sized via `DB_POOL_SIZE` / `DB_MAX_OVERFLOW`;
  Supabase's pooler sits in front for serverless/burst workloads.
- **Storage (optional):** KYC document scans can be uploaded to a Supabase Storage
  bucket and referenced by `kyc_records.document_url` (the app stores the URL, never
  the raw image).
- **Health:** `GET /health/ready` verifies the DB connection and returns 503 if
  Supabase is unreachable — wire it to your host's health check.
