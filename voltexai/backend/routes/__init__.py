from .auth_routes import router as auth_router
from .ai_routes import router as ai_router
from .payment_routes import router as payment_router
from .market_routes import router as market_router
from .signal_routes import router as signal_router
from .directory_routes import router as directory_router
from .fund_routes import router as fund_router
from .trade_routes import router as trade_router
from .kyc_routes import router as kyc_router
from .ecosystem_routes import router as ecosystem_router
from .competition_routes import router as competition_router
from .social_routes import router as social_router
from .hub_routes import router as hub_router
from .community_routes import router as community_router
from .dashboard_routes import router as dashboard_router
from .company_routes import router as company_router
from .journal_routes import router as journal_router
from .pro_signals_routes import router as pro_signals_router
from .telegram_routes import router as telegram_router

__all__ = [
    "auth_router", "ai_router", "payment_router",
    "market_router", "signal_router", "directory_router", "fund_router",
    "trade_router", "kyc_router", "ecosystem_router", "competition_router",
    "social_router", "hub_router", "community_router", "dashboard_router",
    "company_router", "journal_router", "pro_signals_router", "telegram_router",
]
