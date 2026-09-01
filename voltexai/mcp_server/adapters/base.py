"""
Broker-adapter contract for the VoltexAI MCP server (Phase 1+).

An adapter is the ONLY thing that talks to a broker. Tool logic depends on
this interface, never on a specific broker, so later phases can add MetaApi
(MT5), OANDA or cTrader adapters without touching the tools.

Phase 1 is READ-ONLY and DEMO-ONLY:
  - the adapter exposes account + open positions, nothing that moves money;
  - get_account() must refuse a non-demo account unless live access is
    explicitly enabled in config (Phase 1 keeps it disabled).

Credentials live in the process environment and are injected by the adapter.
They are never returned to the caller and never placed in the model context.
"""
from dataclasses import dataclass, field, asdict
from typing import Any


class AdapterError(Exception):
    """Base class for adapter failures (config, auth, transport)."""


class AdapterConfigError(AdapterError):
    """The broker adapter isn't configured (e.g. no API token)."""


class AccountAccessError(AdapterError):
    """Access refused — e.g. a live account while Phase 1 is demo-only."""


@dataclass
class Account:
    """Normalized account snapshot, broker-agnostic."""
    broker: str
    account_id: str
    currency: str
    balance: float
    equity: float
    is_demo: bool
    raw: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("raw", None)          # keep raw out of the model context by default
        return d


@dataclass
class Position:
    """Normalized open position, broker-agnostic."""
    symbol: str
    direction: str                 # "buy" | "sell" | contract type (e.g. CALL/PUT)
    position_id: str
    open_price: float
    current_value: float
    profit: float
    opened_at: str = ""            # ISO-8601 when available
    kind: str = ""                 # broker's contract/position type
    description: str = ""          # human-readable ("longcode" on Deriv)
    raw: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("raw", None)
        return d


class AccountAdapter:
    """Read-only account interface every broker adapter implements."""

    name = "base"

    async def get_account(self) -> Account:
        raise NotImplementedError

    async def list_positions(self) -> list[Position]:
        raise NotImplementedError

    async def close(self) -> None:
        """Release any transport (WebSocket/HTTP). Safe to call twice."""
        return None
