"""
VoltexAI - Configuration
Central settings loaded from environment variables.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

# Always-allowed CORS origins; extra origins come from the CORS_ORIGINS env var.
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173", "http://localhost:3000",
    "https://voltexai.app", "https://app.voltexai.com",
    "https://voltexai.vercel.app",
]


class Settings(BaseSettings):
    # App
    APP_NAME: str = "VoltexAI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Database (SQLite dev; managed Postgres / Supabase in prod)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./voltexai.db"
    )
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "10"))

    # JWT / Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production-32-chars-min")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MIN: int = 30
    REFRESH_TOKEN_TTL_DAYS: int = 14
    PASSWORD_RESET_TTL_MIN: int = 30

    # Anthropic
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
    CLAUDE_MAX_TOKENS: int = 4096

    # --- Market data feed ---
    # Provider order is automatic: a real vendor (if its key is set) is tried
    # first per asset class, then Binance for crypto, then the built-in feed.
    MARKET_DATA_PROVIDER: str = os.getenv("MARKET_DATA_PROVIDER", "auto")  # auto|twelvedata|finnhub|alphavantage|synthetic
    TWELVEDATA_API_KEY: str = os.getenv("TWELVEDATA_API_KEY", "")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    ALPHAVANTAGE_API_KEY: str = os.getenv("ALPHAVANTAGE_API_KEY", "")
    MARKET_CACHE_TTL: float = float(os.getenv("MARKET_CACHE_TTL", "12"))   # seconds

    # --- Voltex Signals SaaS (TradingView -> engine -> Telegram/MT5) ---
    # Shared secret TradingView must include in its webhook body ("secret").
    TRADINGVIEW_WEBHOOK_SECRET: str = os.getenv("TRADINGVIEW_WEBHOOK_SECRET", "")
    # Minimum Voltex Quality Score (0-100) to accept & publish a signal.
    SIGNAL_MIN_SCORE: int = int(os.getenv("SIGNAL_MIN_SCORE", "70"))
    # Telegram bot + channels for Free/VIP publishing (blank = no-op / logged only).
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_FREE_CHANNEL: str = os.getenv("TELEGRAM_FREE_CHANNEL", "")   # @channel or -100id
    TELEGRAM_VIP_CHANNEL: str = os.getenv("TELEGRAM_VIP_CHANNEL", "")
    TELEGRAM_BOT_USERNAME: str = os.getenv("TELEGRAM_BOT_USERNAME", "VoltexAIForexBot")
    # secret path segment for the bot webhook (Telegram -> /api/telegram/webhook/<secret>)
    TELEGRAM_WEBHOOK_SECRET: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    # how often the background VIP-expiry sweep runs (seconds)
    VIP_EXPIRY_SWEEP_SECONDS: int = int(os.getenv("VIP_EXPIRY_SWEEP_SECONDS", "3600"))
    # Shared key the MT5 EA / gateway uses to pull signals and post executions.
    MT5_GATEWAY_KEY: str = os.getenv("MT5_GATEWAY_KEY", "")

    # --- Trade execution ---
    # BROKER "paper" = built-in simulated broker (safe default, no real money).
    #        "alpaca" = real Alpaca API (paper or live per ALPACA_BASE_URL).
    BROKER: str = os.getenv("BROKER", "paper")
    PAPER_STARTING_BALANCE: float = float(os.getenv("PAPER_STARTING_BALANCE", "100000"))
    ALPACA_API_KEY: str = os.getenv("ALPACA_API_KEY", "")
    ALPACA_API_SECRET: str = os.getenv("ALPACA_API_SECRET", "")
    # paper endpoint by default — never silently defaults to live money
    ALPACA_BASE_URL: str = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

    # OANDA (real forex + metals execution). Practice (demo) by default.
    OANDA_API_TOKEN: str = os.getenv("OANDA_API_TOKEN", "")
    OANDA_ACCOUNT_ID: str = os.getenv("OANDA_ACCOUNT_ID", "")
    OANDA_ENVIRONMENT: str = os.getenv("OANDA_ENVIRONMENT", "practice")  # practice | live

    # --- Email (transactional) ---
    # console = log to stdout (dev default); smtp = SMTP server; resend = Resend HTTP API
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "console")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "VoltexAI <no-reply@voltexai.app>")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() == "true"
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    REQUIRE_KYC_FOR_LIVE: bool = os.getenv("REQUIRE_KYC_FOR_LIVE", "false").lower() == "true"

    # Stripe (international cards / USD)
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_STARTER: str = os.getenv("STRIPE_PRICE_STARTER", "")  # $19/mo
    STRIPE_PRICE_TRADER: str = os.getenv("STRIPE_PRICE_TRADER", "")    # $49/mo
    STRIPE_PRICE_PRO: str = os.getenv("STRIPE_PRICE_PRO", "")          # $99/mo
    STRIPE_PRICE_ELITE: str = os.getenv("STRIPE_PRICE_ELITE", "")      # $199/mo
    # Annual (yearly) Stripe recurring prices — 2 months free
    STRIPE_PRICE_STARTER_ANNUAL: str = os.getenv("STRIPE_PRICE_STARTER_ANNUAL", "")  # $190/yr
    STRIPE_PRICE_TRADER_ANNUAL: str = os.getenv("STRIPE_PRICE_TRADER_ANNUAL", "")    # $490/yr
    STRIPE_PRICE_PRO_ANNUAL: str = os.getenv("STRIPE_PRICE_PRO_ANNUAL", "")          # $990/yr
    STRIPE_PRICE_ELITE_ANNUAL: str = os.getenv("STRIPE_PRICE_ELITE_ANNUAL", "")      # $1990/yr

    # Flutterwave (African mobile money / ZMW)
    FLW_SECRET_KEY: str = os.getenv("FLW_SECRET_KEY", "")
    FLW_PUBLIC_KEY: str = os.getenv("FLW_PUBLIC_KEY", "")
    FLW_ENCRYPTION_KEY: str = os.getenv("FLW_ENCRYPTION_KEY", "")
    FLW_WEBHOOK_HASH: str = os.getenv("FLW_WEBHOOK_HASH", "")

    # Pricing (single source of truth) — 5-tier product ladder
    PLAN_STARTER_USD: float = 19.00
    PLAN_TRADER_USD: float = 49.00
    PLAN_PRO_USD: float = 99.00
    PLAN_ELITE_USD: float = 199.00
    USD_TO_ZMW_RATE: float = float(os.getenv("USD_TO_ZMW_RATE", "26.5"))

    # Annual billing: pay for (12 - months_free) months → the rest is free.
    # 2 months free ≈ 17% off. Single knob drives every annual price + savings copy.
    PLAN_ANNUAL_MONTHS_FREE: int = int(os.getenv("PLAN_ANNUAL_MONTHS_FREE", "2"))
    # Money-back guarantee window (days) on annual plans. 0 disables the guarantee.
    PLAN_ANNUAL_MONEYBACK_DAYS: int = int(os.getenv("PLAN_ANNUAL_MONEYBACK_DAYS", "30"))

    # Rate limits per plan (Claude calls per day)
    RATE_FREE: int = 10
    RATE_STARTER: int = 60
    RATE_TRADER: int = 300
    RATE_PRO: int = 800
    RATE_ELITE: int = 2500

    # Brute-force throttle on unauthenticated auth endpoints (disable in tests)
    AUTH_THROTTLE_ENABLED: bool = os.getenv("AUTH_THROTTLE_ENABLED", "true").lower() == "true"

    # CORS — comma-separated extra origins from env (e.g. your Vercel URL).
    # Kept as a STRING: a list-typed field would make pydantic-settings try to
    # JSON-decode the CORS_ORIGINS env var and crash on a plain URL value.
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

    class Config:
        env_file = ".env"
        case_sensitive = True

    # ---- derived helpers ----
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    def cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return list(dict.fromkeys(_DEFAULT_CORS_ORIGINS + extra))

    def validate_runtime(self) -> list[str]:
        """Return a list of production misconfiguration warnings (never raises)."""
        warnings: list[str] = []
        if self.is_production:
            if "change-me" in self.JWT_SECRET or len(self.JWT_SECRET) < 32:
                warnings.append("JWT_SECRET is weak or default — set a 32+ char secret.")
            if self.DATABASE_URL.startswith("sqlite"):
                warnings.append("DATABASE_URL is SQLite — use managed Postgres in prod.")
            if not self.ANTHROPIC_API_KEY:
                warnings.append("ANTHROPIC_API_KEY not set — AI Terminal disabled.")
        return warnings


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
