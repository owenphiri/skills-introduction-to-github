-- ============================================================
-- VoltexAI — Supabase / Postgres schema (reference + optional bootstrap)
--
-- The FastAPI backend auto-creates these tables on boot via SQLAlchemy, so you do
-- NOT have to run this file. It is provided for a SQL-first setup, for review, and
-- as the place to add Supabase-specific indexes / policies.
--
-- SECURITY NOTE: VoltexAI's browser/mobile clients talk to the FastAPI API, not to
-- Supabase directly. The API connects with a privileged Postgres role and is the
-- trusted gatekeeper (JWT auth + plan/role checks), so Row Level Security is NOT
-- required for the app to be safe. Enable RLS only if you also expose these tables
-- through Supabase's auto-generated PostgREST/Realtime APIs.
--
-- Apply:  psql "$DATABASE_URL" -f schema.sql
--     or: Supabase Dashboard → SQL Editor → paste → Run
--     or: mcp apply_migration (name: voltexai_initial_schema)
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120),
    country         VARCHAR(60),
    phone           VARCHAR(40),
    role            VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    last_login_at   TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan                VARCHAR(20) NOT NULL DEFAULT 'free',
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    provider            VARCHAR(20) NOT NULL DEFAULT 'none',
    external_id         VARCHAR(255),
    current_period_end  TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at          TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS payments (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      VARCHAR(20) NOT NULL,
    provider_ref  VARCHAR(255),
    amount        DOUBLE PRECISION NOT NULL,
    currency      VARCHAR(8) NOT NULL,
    plan          VARCHAR(20) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    method        VARCHAR(40),
    raw_payload   VARCHAR(4000),
    created_at    TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_payments_provider_ref ON payments(provider_ref);

CREATE TABLE IF NOT EXISTS conversations (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL DEFAULT 'New conversation',
    mode        VARCHAR(30) NOT NULL DEFAULT 'terminal',
    created_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    updated_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS messages (
    id               SERIAL PRIMARY KEY,
    conversation_id  INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role             VARCHAR(20) NOT NULL,
    content          TEXT NOT NULL,
    tokens_in        INTEGER DEFAULT 0,
    tokens_out       INTEGER DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS broker_accounts (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker            VARCHAR(20) NOT NULL DEFAULT 'paper',
    currency          VARCHAR(8) NOT NULL DEFAULT 'USD',
    cash_balance      DOUBLE PRECISION NOT NULL,
    starting_balance  DOUBLE PRECISION NOT NULL,
    realized_pnl      DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS positions (
    id          SERIAL PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    symbol      VARCHAR(20) NOT NULL,
    qty         DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_price   DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_positions_symbol ON positions(symbol);

CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    account_id    INTEGER NOT NULL REFERENCES broker_accounts(id) ON DELETE CASCADE,
    symbol        VARCHAR(20) NOT NULL,
    side          VARCHAR(10) NOT NULL,
    type          VARCHAR(10) NOT NULL DEFAULT 'market',
    qty           DOUBLE PRECISION NOT NULL,
    limit_price   DOUBLE PRECISION,
    status        VARCHAR(12) NOT NULL DEFAULT 'pending',
    filled_price  DOUBLE PRECISION,
    realized_pnl  DOUBLE PRECISION NOT NULL DEFAULT 0,
    note          VARCHAR(255),
    created_at    TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    filled_at     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_orders_symbol ON orders(symbol);

CREATE TABLE IF NOT EXISTS kyc_records (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(12) NOT NULL DEFAULT 'pending',
    full_legal_name  VARCHAR(160) NOT NULL,
    date_of_birth    VARCHAR(20),
    country          VARCHAR(60),
    document_type    VARCHAR(40),
    document_number  VARCHAR(80),
    document_url     VARCHAR(500),
    reject_reason    VARCHAR(300),
    submitted_at     TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    reviewed_at      TIMESTAMP
);

-- ============================================================
-- Deny-all Row Level Security (RECOMMENDED — applied on the live project).
-- Supabase auto-exposes the public schema through its anon PostgREST API, so
-- without RLS these tables would be readable with the anon key. Enabling RLS with
-- NO policies blocks that anon API entirely, while the FastAPI backend (which
-- connects as the privileged 'postgres' role) BYPASSES RLS and is unaffected.
-- Only add policies if you deliberately expose tables through Supabase's data API.
-- ============================================================
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records      ENABLE ROW LEVEL SECURITY;
