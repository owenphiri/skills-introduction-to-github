"""
VoltexAI - Configuration
Central settings loaded from environment variables.
"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "VoltexAI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./voltexai.db"
    )

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
    MARKET_DATA_PROVIDER: str = os.getenv("MARKET_DATA_PROVIDER", "auto")  # auto|twelvedata|finnhub|synthetic
    TWELVEDATA_API_KEY: str = os.getenv("TWELVEDATA_API_KEY", "")
    FINNHUB_API_KEY: str = os.getenv("FINNHUB_API_KEY", "")
    MARKET_CACHE_TTL: float = float(os.getenv("MARKET_CACHE_TTL", "12"))   # seconds

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
    STRIPE_PRICE_TRADER: str = os.getenv("STRIPE_PRICE_TRADER", "")  # $29 plan
    STRIPE_PRICE_ELITE: str = os.getenv("STRIPE_PRICE_ELITE", "")    # $99 plan

    # Flutterwave (African mobile money / ZMW)
    FLW_SECRET_KEY: str = os.getenv("FLW_SECRET_KEY", "")
    FLW_PUBLIC_KEY: str = os.getenv("FLW_PUBLIC_KEY", "")
    FLW_ENCRYPTION_KEY: str = os.getenv("FLW_ENCRYPTION_KEY", "")
    FLW_WEBHOOK_HASH: str = os.getenv("FLW_WEBHOOK_HASH", "")

    # Pricing (single source of truth)
    PLAN_TRADER_USD: float = 29.00
    PLAN_ELITE_USD: float = 99.00
    USD_TO_ZMW_RATE: float = float(os.getenv("USD_TO_ZMW_RATE", "26.5"))

    # Rate limits per plan (Claude calls per day)
    RATE_FREE: int = 10
    RATE_TRADER: int = 250
    RATE_ELITE: int = 2000

    # Brute-force throttle on unauthenticated auth endpoints (disable in tests)
    AUTH_THROTTLE_ENABLED: bool = os.getenv("AUTH_THROTTLE_ENABLED", "true").lower() == "true"

    # CORS — defaults + comma-separated CORS_ORIGINS env (e.g. your Vercel URL)
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000",
                          "https://voltexai.app", "https://app.voltexai.com"]
    EXTRA_CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "")

    class Config:
        env_file = ".env"
        case_sensitive = True

    # ---- derived helpers ----
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in ("production", "prod")

    def cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.EXTRA_CORS_ORIGINS.split(",") if o.strip()]
        return list(dict.fromkeys(self.CORS_ORIGINS + extra))

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
