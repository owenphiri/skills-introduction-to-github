"""
VoltexAI - FastAPI entrypoint
Run:  uvicorn backend.main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import init_db, engine
from .middleware.hardening import SecurityHeadersMiddleware, RequestContextMiddleware
from .routes import (auth_router, ai_router, payment_router,
                     market_router, signal_router, directory_router, fund_router,
                     trade_router, kyc_router)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("voltexai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Booting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION,
                settings.ENVIRONMENT)
    init_db()
    logger.info("Database ready")
    for w in settings.validate_runtime():
        logger.warning("CONFIG: %s", w)
    from .services import data_providers
    ps = data_providers.provider_status()
    logger.info("Market data: configured=%s active=%s (twelvedata_key=%s finnhub_key=%s)",
                ps["configured"], ps["active_primary"],
                ps["twelvedata_key_present"], ps["finnhub_key_present"])
    logger.info("Trade broker: %s", settings.BROKER)
    from .services.oanda_stream import oanda_stream
    if oanda_stream.configured() and settings.MARKET_DATA_PROVIDER != "synthetic":
        await oanda_stream.start()
    yield
    await oanda_stream.stop()
    logger.info("Shutting down")


app = FastAPI(
    title="VoltexAI API",
    description="AI trading terminal for African traders. "
                "Powered by PrimeAxis ICT Trade & Solutions Ltd.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Middleware order: last-added runs outermost. Security headers wrap everything,
# then request-context (id/timing/catch-all), CORS, and GZip innermost.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time-ms"],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.is_production)

app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(payment_router)
app.include_router(market_router)
app.include_router(signal_router)
app.include_router(directory_router)
app.include_router(fund_router)
app.include_router(trade_router)
app.include_router(kyc_router)


@app.get("/")
def root():
    return {"name": "VoltexAI", "version": settings.APP_VERSION,
            "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy", "env": settings.ENVIRONMENT,
            "version": settings.APP_VERSION}


@app.get("/health/ready")
def readiness():
    """Deep readiness probe: verifies the DB is reachable. 503 if not."""
    from sqlalchemy import text
    checks = {"database": "ok"}
    healthy = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        checks["database"] = f"error: {type(e).__name__}"
        healthy = False
    body = {"status": "ready" if healthy else "not_ready", "checks": checks}
    return JSONResponse(status_code=200 if healthy else 503, content=body)
