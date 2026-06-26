from .auth_routes import router as auth_router
from .ai_routes import router as ai_router
from .payment_routes import router as payment_router
from .market_routes import router as market_router
from .signal_routes import router as signal_router
from .directory_routes import router as directory_router
from .fund_routes import router as fund_router

__all__ = [
    "auth_router", "ai_router", "payment_router",
    "market_router", "signal_router", "directory_router", "fund_router",
]
