"""
VoltexAI - FastAPI entrypoint
Run:  uvicorn backend.main:app --reload --port 8000
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import init_db
from .routes import (auth_router, ai_router, payment_router,
                     market_router, signal_router, directory_router, fund_router)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger("voltexai")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Booting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION,
                settings.ENVIRONMENT)
    init_db()
    logger.info("Database ready")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="VoltexAI API",
    description="AI trading terminal for African traders. "
                "Powered by PrimeAxis ICT Trade & Solutions Ltd.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(payment_router)
app.include_router(market_router)
app.include_router(signal_router)
app.include_router(directory_router)
app.include_router(fund_router)


@app.get("/")
def root():
    return {"name": "VoltexAI", "version": settings.APP_VERSION,
            "status": "ok", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy", "env": settings.ENVIRONMENT}
