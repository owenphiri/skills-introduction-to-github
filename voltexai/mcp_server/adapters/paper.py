"""
Paper-broker adapter (Phase 2).

Simulates order fills against VoltexAI's own market_service prices (live when a
provider is configured, else the synthetic feed) and persists a JSON book, so
positions and P/L survive across tool calls and server restarts. No real broker,
no real money — this is where order tools are exercised safely behind the risk
layer.

P/L model (documented, intentionally simple): a position's profit is
    (current_price - entry_price) * size * direction
where direction is +1 for buy, -1 for sell. `size` is notional units, not lots;
this is a teaching/paper simulator, not a margin engine.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any

from backend.services import market_service
from .. import config
from .base import Account, AccountAdapter, AdapterError, Fill, OrderIntent, Position


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


class PaperBroker(AccountAdapter):
    name = "paper"
    supports_orders = True

    def __init__(self, path: str | None = None, starting_balance: float | None = None):
        self._path = path or config.PAPER_BOOK
        self._start = config.PAPER_BALANCE if starting_balance is None else starting_balance
        self._book = self._load()

    # ---- persistence -------------------------------------------------------
    def _fresh(self) -> dict[str, Any]:
        return {"balance": float(self._start), "positions": [],
                "realized_by_date": {}, "trades": [], "seq": 0}

    def _load(self) -> dict[str, Any]:
        if not os.path.exists(self._path):
            return self._fresh()
        try:
            with open(self._path, "r", encoding="utf-8") as fh:
                book = json.load(fh)
        except (OSError, ValueError):
            return self._fresh()
        for k, v in self._fresh().items():
            book.setdefault(k, v)
        return book

    def _save(self) -> None:
        tmp = f"{self._path}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(self._book, fh, indent=2)
        os.replace(tmp, self._path)

    # ---- pricing -----------------------------------------------------------
    async def _price(self, symbol: str) -> float:
        quotes = await market_service.get_quotes([symbol])
        if not quotes or "price" not in quotes[0]:
            raise AdapterError(f"No price available for '{symbol}'.")
        return float(quotes[0]["price"])

    @staticmethod
    def _mult(side: str) -> int:
        return 1 if side.lower() == "buy" else -1

    def _unrealized(self, pos: dict[str, Any], price: float) -> float:
        return (price - pos["entry_price"]) * pos["size"] * self._mult(pos["side"])

    # ---- read-only interface ----------------------------------------------
    async def get_account(self) -> Account:
        unrealized = 0.0
        for pos in self._book["positions"]:
            try:
                unrealized += self._unrealized(pos, await self._price(pos["symbol"]))
            except AdapterError:
                continue
        balance = float(self._book["balance"])
        return Account(
            broker="paper", account_id="PAPER", currency="USD",
            balance=round(balance, 2), equity=round(balance + unrealized, 2),
            is_demo=True,
            raw={"realized_today": self._book["realized_by_date"].get(_today(), 0.0)},
        )

    async def list_positions(self) -> list[Position]:
        out: list[Position] = []
        for pos in self._book["positions"]:
            try:
                price = await self._price(pos["symbol"])
            except AdapterError:
                price = pos["entry_price"]
            out.append(Position(
                symbol=pos["symbol"], direction=pos["side"], position_id=pos["id"],
                open_price=pos["entry_price"], current_value=round(price, 6),
                profit=round(self._unrealized(pos, price), 2),
                opened_at=pos.get("opened_at", ""), kind="paper",
                description=f"{pos['side']} {pos['size']} {pos['symbol']} @ {pos['entry_price']}",
                raw=dict(pos),
            ))
        return out

    async def realized_pnl_today(self) -> float:
        return float(self._book["realized_by_date"].get(_today(), 0.0))

    # ---- order interface ---------------------------------------------------
    async def place_order(self, intent: OrderIntent) -> Fill:
        price = await self._price(intent.symbol)
        self._book["seq"] += 1
        pid = f"P{self._book['seq']}"
        pos = {"id": pid, "symbol": intent.symbol.upper(), "side": intent.side.lower(),
               "size": float(intent.size), "entry_price": round(price, 6),
               "opened_at": _now_iso()}
        self._book["positions"].append(pos)
        self._save()
        return Fill(position_id=pid, symbol=pos["symbol"], side=pos["side"],
                    size=pos["size"], price=pos["entry_price"], opened_at=pos["opened_at"])

    async def close_position(self, position_id: str) -> dict[str, Any]:
        positions = self._book["positions"]
        idx = next((i for i, p in enumerate(positions) if p["id"] == position_id), None)
        if idx is None:
            raise AdapterError(f"No open position '{position_id}'.")
        pos = positions.pop(idx)
        exit_price = await self._price(pos["symbol"])
        pnl = round(self._unrealized(pos, exit_price), 2)
        self._book["balance"] = round(float(self._book["balance"]) + pnl, 2)
        day = _today()
        self._book["realized_by_date"][day] = round(
            self._book["realized_by_date"].get(day, 0.0) + pnl, 2)
        trade = {**pos, "exit_price": round(exit_price, 6), "pnl": pnl,
                 "closed_at": _now_iso()}
        self._book["trades"].append(trade)
        self._save()
        return {"closed": position_id, "symbol": pos["symbol"], "side": pos["side"],
                "size": pos["size"], "entry_price": pos["entry_price"],
                "exit_price": round(exit_price, 6), "pnl": pnl,
                "balance": self._book["balance"]}
