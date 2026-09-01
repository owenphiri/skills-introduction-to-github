"""
Broker-adapter registry.

`get_adapter()` builds the adapter named by MCP_BROKER (default "deriv"). Add a
broker in a later phase by registering its class here; the account tools never
name a specific broker.
"""
from .. import config
from .base import (
    Account,
    AccountAdapter,
    AccountAccessError,
    AdapterConfigError,
    AdapterError,
    Position,
)

__all__ = [
    "Account",
    "AccountAdapter",
    "AccountAccessError",
    "AdapterConfigError",
    "AdapterError",
    "Position",
    "get_adapter",
    "available_brokers",
]


def available_brokers() -> list[str]:
    return ["deriv"]


def get_adapter(broker: str | None = None) -> AccountAdapter:
    """Return a fresh adapter for the configured (or named) broker."""
    name = (broker or config.BROKER).strip().lower()
    if name == "deriv":
        from .deriv import DerivAdapter
        return DerivAdapter()
    raise AdapterConfigError(
        f"Unknown broker '{name}'. Available: {', '.join(available_brokers())}."
    )
