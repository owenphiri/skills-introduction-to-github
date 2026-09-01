"""
Server-side risk layer (Phase 2).

Every order goes through RiskLayer.check() *before* it reaches a broker
adapter. The model cannot bypass it: order_tools always calls it, and a
rejected intent is never passed to place_order. Limits come from config
(environment), so an operator sets guardrails the agent cannot change.

Rules enforced:
  - kill switch (hard stop on all new orders);
  - symbol allowlist (empty = allow any known instrument);
  - max order size;
  - max open positions;
  - daily loss limit (block new opens once today's realized loss hits it).

Pure and dependency-free: takes numbers + an intent, returns a decision.
"""
from dataclasses import dataclass, field
from math import isfinite

from . import config
from .adapters.base import OrderIntent

_SIDES = ("buy", "sell")


@dataclass
class RiskConfig:
    max_order_size: float
    max_open_positions: int
    max_daily_loss: float                       # positive number, account ccy
    symbol_allowlist: list[str] = field(default_factory=list)
    kill_switch: bool = False

    @classmethod
    def from_config(cls) -> "RiskConfig":
        return cls(
            max_order_size=config.MAX_ORDER_SIZE,
            max_open_positions=config.MAX_OPEN_POSITIONS,
            max_daily_loss=config.MAX_DAILY_LOSS,
            symbol_allowlist=list(config.SYMBOL_ALLOWLIST),
            kill_switch=config.KILL_SWITCH,
        )

    def as_dict(self) -> dict:
        return {
            "max_order_size": self.max_order_size,
            "max_open_positions": self.max_open_positions,
            "max_daily_loss": self.max_daily_loss,
            "symbol_allowlist": self.symbol_allowlist or "any known instrument",
            "kill_switch": self.kill_switch,
        }


@dataclass
class RiskDecision:
    approved: bool
    reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"approved": self.approved, "reasons": self.reasons}


class RiskLayer:
    def __init__(self, cfg: RiskConfig | None = None):
        self.cfg = cfg or RiskConfig.from_config()

    def check(
        self,
        intent: OrderIntent,
        *,
        open_positions: int,
        realized_pnl_today: float,
    ) -> RiskDecision:
        c = self.cfg
        reasons: list[str] = []

        if c.kill_switch:
            reasons.append("Kill switch is engaged — new orders are blocked.")

        side = (intent.side or "").lower()
        if side not in _SIDES:
            reasons.append(f"Invalid side '{intent.side}' (use buy or sell).")

        try:
            size = float(intent.size)
        except (TypeError, ValueError):
            size = float("nan")
        if not isfinite(size) or size <= 0:
            reasons.append("Order size must be a positive number.")
        elif size > c.max_order_size:
            reasons.append(
                f"Order size {size} exceeds max_order_size {c.max_order_size}."
            )

        sym = (intent.symbol or "").upper()
        if c.symbol_allowlist and sym not in c.symbol_allowlist:
            reasons.append(
                f"Symbol {sym} is not in the allowlist {c.symbol_allowlist}."
            )

        if open_positions >= c.max_open_positions:
            reasons.append(
                f"Open positions {open_positions} at limit "
                f"max_open_positions {c.max_open_positions}."
            )

        # realized_pnl_today is negative when losing.
        if realized_pnl_today <= -abs(c.max_daily_loss):
            reasons.append(
                f"Daily loss limit reached (realized {realized_pnl_today}, "
                f"limit -{abs(c.max_daily_loss)})."
            )

        return RiskDecision(approved=not reasons, reasons=reasons)
