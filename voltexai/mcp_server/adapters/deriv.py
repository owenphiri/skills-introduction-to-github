"""
Deriv broker adapter (Phase 1, read-only).

Talks to the Deriv WebSocket API (https://api.deriv.com):
    authorize -> balance/account, portfolio -> open positions.

Demo-only: get_account() refuses a non-virtual account unless MCP_ALLOW_LIVE
is set. Only `websockets` is needed and it is imported lazily, so importing
this module never fails when the SDK/transport is absent — the error surfaces
at connect time as a clean AdapterError.
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from .. import config
from .base import (
    Account,
    AccountAdapter,
    AccountAccessError,
    AdapterConfigError,
    AdapterError,
    Position,
)

# Deriv contract types -> normalized direction.
_DIRECTION = {
    "CALL": "buy", "CALLE": "buy", "MULTUP": "buy",
    "PUT": "sell", "PUTE": "sell", "MULTDOWN": "sell",
}
# Cap best-effort per-contract profit lookups so a big book can't hang a call.
_MAX_ENRICH = 25


def _iso(epoch: Any) -> str:
    try:
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return ""


class DerivAdapter(AccountAdapter):
    name = "deriv"

    def __init__(self, token: str | None = None, app_id: str | None = None):
        self._token = (token or config.DERIV_API_TOKEN).strip()
        self._app_id = (app_id or config.DERIV_APP_ID).strip()
        self._ws = None
        self._req_id = 0
        self._authorized: dict[str, Any] | None = None

    # ---- transport ---------------------------------------------------------
    async def _connect(self):
        if self._ws is not None:
            return self._ws
        if not self._token:
            raise AdapterConfigError(
                "Deriv is not configured. Set DERIV_API_TOKEN (a demo API "
                "token from Deriv > Account settings > API token)."
            )
        try:
            import websockets
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise AdapterError(
                "The 'websockets' package is required for the Deriv adapter "
                "(pip install -r requirements-mcp.txt)."
            ) from exc
        url = f"{config.DERIV_WS_URL}?app_id={self._app_id}"
        try:
            self._ws = await websockets.connect(url, open_timeout=config.DERIV_TIMEOUT)
        except Exception as exc:  # noqa: BLE001 - normalize any transport error
            raise AdapterError(f"Could not reach Deriv: {exc}") from exc
        return self._ws

    async def _call(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send one request and return its matching response (by req_id)."""
        ws = await self._connect()
        self._req_id += 1
        rid = self._req_id
        payload = {**payload, "req_id": rid}
        try:
            await asyncio.wait_for(ws.send(json.dumps(payload)), config.DERIV_TIMEOUT)
            # Read until the response echoing our req_id arrives.
            while True:
                raw = await asyncio.wait_for(ws.recv(), config.DERIV_TIMEOUT)
                msg = json.loads(raw)
                if msg.get("req_id") == rid:
                    break
        except asyncio.TimeoutError as exc:
            raise AdapterError("Deriv request timed out.") from exc
        except Exception as exc:  # noqa: BLE001
            raise AdapterError(f"Deriv transport error: {exc}") from exc
        if "error" in msg:
            err = msg["error"]
            raise AdapterError(f"Deriv API error: {err.get('message', err)}")
        return msg

    async def _authorize(self) -> dict[str, Any]:
        if self._authorized is None:
            msg = await self._call({"authorize": self._token})
            self._authorized = msg["authorize"]
        return self._authorized

    # ---- read-only account interface --------------------------------------
    async def get_account(self) -> Account:
        auth = await self._authorize()
        is_demo = bool(auth.get("is_virtual"))
        if not is_demo and not config.ALLOW_LIVE:
            raise AccountAccessError(
                "This is a LIVE Deriv account. Phase 1 is demo-only; connect a "
                "virtual (demo) account, or set MCP_ALLOW_LIVE to override."
            )
        bal = await self._call({"balance": 1})
        balance = float(bal["balance"]["balance"])
        return Account(
            broker="deriv",
            account_id=str(auth.get("loginid", "")),
            currency=str(auth.get("currency", bal["balance"].get("currency", ""))),
            balance=balance,
            equity=balance,          # Deriv has no separate equity for demo book
            is_demo=is_demo,
            raw={"authorize": auth, "balance": bal.get("balance", {})},
        )

    async def list_positions(self) -> list[Position]:
        await self._authorize()
        pf = await self._call({"portfolio": 1})
        contracts = pf.get("portfolio", {}).get("contracts", []) or []
        positions = [self._to_position(c) for c in contracts]
        await self._enrich(positions)
        return positions

    def _to_position(self, c: dict[str, Any]) -> Position:
        ctype = str(c.get("contract_type", ""))
        buy_price = float(c.get("buy_price", 0) or 0)
        return Position(
            symbol=str(c.get("symbol", "")),
            direction=_DIRECTION.get(ctype, ctype),
            position_id=str(c.get("contract_id", "")),
            open_price=buy_price,
            current_value=buy_price,     # refined by _enrich when reachable
            profit=0.0,
            opened_at=_iso(c.get("purchase_time")),
            kind=ctype,
            description=str(c.get("longcode", "")),
            raw=dict(c),
        )

    async def _enrich(self, positions: list[Position]) -> None:
        """Best-effort current value/profit via proposal_open_contract."""
        for p in positions[:_MAX_ENRICH]:
            if not p.position_id:
                continue
            try:
                msg = await self._call(
                    {"proposal_open_contract": 1, "contract_id": int(p.position_id)}
                )
                poc = msg.get("proposal_open_contract", {}) or {}
                if "bid_price" in poc:
                    p.current_value = float(poc["bid_price"])
                if "profit" in poc:
                    p.profit = float(poc["profit"])
            except (AdapterError, ValueError, KeyError):
                continue     # leave the buy-price fallback; never fail the list

    async def close(self) -> None:
        ws, self._ws = self._ws, None
        self._authorized = None
        if ws is not None:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass
