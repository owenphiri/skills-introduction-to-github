"""
VoltexAI - Deriv live execution client (auto-trader live venue).

Places directional trades on Deriv via its WebSocket API using MULTIPLIER
contracts (MULTUP for LONG, MULTDOWN for SHORT) — the right primitive for a
stop-loss / take-profit-bracketed directional position on synthetic indices.

SAFETY, in layers (this is only ever reached when the auto-trader is in LIVE
mode, which itself already requires a token + an explicit opt-in):
  * DEMO-FIRST: execute() refuses a REAL Deriv account unless allow_real=True.
    Without that second flag, only virtual (demo) accounts are traded.
  * The auto-trader risk layer runs BEFORE anything here — this client never
    sees an order the risk layer rejected.
  * Every call is defensive: it returns {"error": ...} rather than raising, so
    a venue problem degrades to a skipped trade, never a crash.

`websockets` is imported lazily so importing this module never fails when the
transport isn't installed.
"""
from __future__ import annotations

import asyncio
import json
import os

DERIV_WS_URL = os.getenv("DERIV_WS_URL", "wss://ws.derivws.com/websockets/v3").strip()
DERIV_APP_ID = os.getenv("DERIV_APP_ID", "1089").strip()
DERIV_TIMEOUT = float(os.getenv("DERIV_TIMEOUT", "20"))

# LONG/SHORT -> Deriv multiplier contract type
_CONTRACT = {"LONG": "MULTUP", "BUY": "MULTUP", "SHORT": "MULTDOWN", "SELL": "MULTDOWN"}


class DerivExecError(Exception):
    pass


class DerivExecClient:
    """One short-lived WebSocket session: authorize, buy, sell, close."""

    def __init__(self, token: str | None = None, app_id: str | None = None):
        self._token = (token or os.getenv("DERIV_API_TOKEN", "")).strip()
        self._app_id = (app_id or DERIV_APP_ID).strip()
        self._ws = None
        self._req_id = 0
        self._auth: dict | None = None

    async def _connect(self):
        if self._ws is not None:
            return self._ws
        if not self._token:
            raise DerivExecError("Deriv not configured (DERIV_API_TOKEN missing).")
        try:
            import websockets
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise DerivExecError("The 'websockets' package is required for live Deriv execution.") from exc
        url = f"{DERIV_WS_URL}?app_id={self._app_id}"
        try:
            self._ws = await websockets.connect(url, open_timeout=DERIV_TIMEOUT)
        except Exception as exc:  # noqa: BLE001
            raise DerivExecError(f"Could not reach Deriv: {exc}") from exc
        return self._ws

    async def _call(self, payload: dict) -> dict:
        ws = await self._connect()
        self._req_id += 1
        rid = self._req_id
        try:
            await asyncio.wait_for(ws.send(json.dumps({**payload, "req_id": rid})), DERIV_TIMEOUT)
            while True:
                raw = await asyncio.wait_for(ws.recv(), DERIV_TIMEOUT)
                msg = json.loads(raw)
                if msg.get("req_id") == rid:
                    break
        except asyncio.TimeoutError as exc:
            raise DerivExecError("Deriv request timed out.") from exc
        except Exception as exc:  # noqa: BLE001
            raise DerivExecError(f"Deriv transport error: {exc}") from exc
        if "error" in msg:
            raise DerivExecError(msg["error"].get("message", str(msg["error"])))
        return msg

    async def authorize(self) -> dict:
        if self._auth is None:
            self._auth = (await self._call({"authorize": self._token}))["authorize"]
        return self._auth

    async def buy_multiplier(self, deriv_symbol: str, direction: str, stake: float,
                             multiplier: int, currency: str,
                             stop_loss: float | None = None,
                             take_profit: float | None = None) -> dict:
        ctype = _CONTRACT.get(direction.upper())
        if not ctype:
            raise DerivExecError(f"Unsupported direction '{direction}'.")
        params = {
            "amount": round(float(stake), 2), "basis": "stake",
            "contract_type": ctype, "currency": currency,
            "symbol": deriv_symbol, "multiplier": int(multiplier),
        }
        limit = {}
        if stop_loss:
            limit["stop_loss"] = round(float(stop_loss), 2)
        if take_profit:
            limit["take_profit"] = round(float(take_profit), 2)
        if limit:
            params["limit_order"] = limit
        prop = (await self._call({"proposal": 1, **params}))["proposal"]
        ask = float(prop["ask_price"])
        bought = (await self._call({"buy": prop["id"], "price": ask}))["buy"]
        return {
            "contract_id": bought["contract_id"], "buy_price": float(bought["buy_price"]),
            "longcode": bought.get("longcode", ""), "transaction_id": bought.get("transaction_id"),
            "symbol": deriv_symbol, "contract_type": ctype, "multiplier": int(multiplier),
        }

    async def sell_contract(self, contract_id) -> dict:
        sold = (await self._call({"sell": contract_id, "price": 0}))["sell"]
        return {"contract_id": contract_id, "sold_for": float(sold.get("sold_for", 0)),
                "reference_id": sold.get("reference_id"), "balance_after": sold.get("balance_after")}

    async def close(self) -> None:
        ws, self._ws = self._ws, None
        self._auth = None
        if ws is not None:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass


# ----------------------------- public helpers -----------------------------
async def _execute(sig: dict, *, deriv_symbol: str, stake: float, multiplier: int,
                   stop_loss_amt: float | None, take_profit_amt: float | None,
                   allow_real: bool, token: str | None = None) -> dict:
    client = DerivExecClient(token=token)
    try:
        auth = await client.authorize()
        is_virtual = bool(auth.get("is_virtual"))
        if not is_virtual and not allow_real:
            return {"error": "real Deriv account blocked (set AUTOTRADE_ALLOW_REAL=true to trade real money)"}
        ccy = str(auth.get("currency", "USD"))
        fill = await client.buy_multiplier(
            deriv_symbol, sig["direction"], stake, multiplier, ccy,
            stop_loss=stop_loss_amt, take_profit=take_profit_amt)
        fill["is_virtual"] = is_virtual
        fill["account"] = auth.get("loginid")
        return fill
    except DerivExecError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"unexpected Deriv execution failure: {exc}"}
    finally:
        await client.close()


def execute(sig: dict, *, deriv_symbol: str, stake: float, multiplier: int,
            stop_loss_amt: float | None = None, take_profit_amt: float | None = None,
            allow_real: bool = False, token: str | None = None) -> dict:
    """Synchronous entry point used by the (sync) auto-trader."""
    return asyncio.run(_execute(
        sig, deriv_symbol=deriv_symbol, stake=stake, multiplier=multiplier,
        stop_loss_amt=stop_loss_amt, take_profit_amt=take_profit_amt,
        allow_real=allow_real, token=token))


async def _close(contract_id, token: str | None = None) -> dict:
    client = DerivExecClient(token=token)
    try:
        await client.authorize()
        return await client.sell_contract(contract_id)
    except DerivExecError as exc:
        return {"error": str(exc)}
    finally:
        await client.close()


def close_contract(contract_id, token: str | None = None) -> dict:
    return asyncio.run(_close(contract_id, token=token))
