"""
VoltexAI - Trade execution engine
Two interchangeable brokers behind one interface:

  * PaperBroker  — the safe default. A fully-functional simulated broker that
    persists accounts, positions and orders in our DB and fills market orders at
    the live (or model) quote. No real money ever moves. Supports long & short.

  * AlpacaBroker — real execution via the Alpaca REST API. Defaults to Alpaca's
    PAPER endpoint; only touches live money if ALPACA_BASE_URL is pointed at the
    live host AND keys are set. Covers US stocks and crypto.

`get_broker()` picks the implementation from settings. Both expose the same async
methods so the routes never branch on broker type. All money figures are in the
account currency (USD).
"""
from __future__ import annotations

import logging
from datetime import datetime

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models import (User, BrokerAccount, Position, Order,
                      OrderSide, OrderType, OrderStatus)
from ..data.instruments import get_instrument
from . import market_service as mkt

logger = logging.getLogger(__name__)


# ============================================================
#  Internal paper broker (DB-backed, safe default)
# ============================================================
class PaperBroker:
    name = "paper"

    def _account(self, db: Session, user: User) -> BrokerAccount:
        acc = (db.query(BrokerAccount)
                 .filter(BrokerAccount.user_id == user.id).first())
        if not acc:
            acc = BrokerAccount(
                user_id=user.id, broker="paper", currency="USD",
                cash_balance=settings.PAPER_STARTING_BALANCE,
                starting_balance=settings.PAPER_STARTING_BALANCE,
            )
            db.add(acc)
            db.commit()
            db.refresh(acc)
        return acc

    def _position(self, db: Session, acc: BrokerAccount, symbol: str) -> Position:
        pos = (db.query(Position)
                 .filter(Position.account_id == acc.id,
                         Position.symbol == symbol).first())
        if not pos:
            pos = Position(account_id=acc.id, symbol=symbol, qty=0.0, avg_price=0.0)
            db.add(pos)
            db.flush()
        return pos

    async def _prices(self, symbols: list[str]) -> dict[str, float]:
        out = {}
        for s in symbols:
            p = await mkt.get_price(s)
            if p is not None:
                out[s] = p
        return out

    async def get_account(self, db: Session, user: User) -> dict:
        acc = self._account(db, user)
        await self._fill_pending(db, acc)
        positions = [p for p in acc.positions if abs(p.qty) > 1e-9]
        prices = await self._prices([p.symbol for p in positions])
        unrealized = 0.0
        market_value = 0.0
        for p in positions:
            px = prices.get(p.symbol, p.avg_price)
            market_value += p.qty * px
            unrealized += p.qty * (px - p.avg_price)
        equity = acc.cash_balance + market_value
        ret_pct = ((equity - acc.starting_balance) / acc.starting_balance * 100
                   if acc.starting_balance else 0.0)
        return {
            "broker": "paper",
            "currency": acc.currency,
            "cash": round(acc.cash_balance, 2),
            "equity": round(equity, 2),
            "market_value": round(market_value, 2),
            "starting_balance": round(acc.starting_balance, 2),
            "realized_pnl": round(acc.realized_pnl, 2),
            "unrealized_pnl": round(unrealized, 2),
            "total_return_pct": round(ret_pct, 2),
            "open_positions": len(positions),
            "buying_power": round(acc.cash_balance, 2),
            "is_live": False,
        }

    async def get_positions(self, db: Session, user: User) -> list[dict]:
        acc = self._account(db, user)
        await self._fill_pending(db, acc)
        positions = [p for p in acc.positions if abs(p.qty) > 1e-9]
        prices = await self._prices([p.symbol for p in positions])
        out = []
        for p in positions:
            px = prices.get(p.symbol, p.avg_price)
            inst = get_instrument(p.symbol)
            upl = p.qty * (px - p.avg_price)
            cost = abs(p.qty) * p.avg_price
            out.append({
                "symbol": p.symbol,
                "display": inst["display"] if inst else p.symbol,
                "side": "long" if p.qty > 0 else "short",
                "qty": round(p.qty, 6),
                "avg_price": round(p.avg_price, 6),
                "current_price": round(px, 6),
                "market_value": round(p.qty * px, 2),
                "unrealized_pnl": round(upl, 2),
                "unrealized_pct": round((upl / cost * 100) if cost else 0.0, 2),
            })
        return out

    async def place_order(self, db: Session, user: User, symbol: str, side: str,
                          qty: float, order_type: str = "market",
                          limit_price: float | None = None,
                          note: str | None = None) -> dict:
        symbol = symbol.upper()
        inst = get_instrument(symbol)
        if not inst:
            raise HTTPException(400, f"Unknown instrument: {symbol}")
        if qty <= 0:
            raise HTTPException(400, "Quantity must be positive")
        side_e = OrderSide(side.lower())
        type_e = OrderType(order_type.lower())
        acc = self._account(db, user)

        order = Order(account_id=acc.id, symbol=symbol, side=side_e, type=type_e,
                      qty=qty, limit_price=limit_price, note=note,
                      status=OrderStatus.PENDING)
        db.add(order)
        db.flush()

        price = await mkt.get_price(symbol)
        if price is None:
            order.status = OrderStatus.REJECTED
            order.note = "no market price"
            db.commit()
            raise HTTPException(502, "No market price available")

        if type_e == OrderType.LIMIT:
            # fill immediately if marketable, else leave pending
            marketable = ((side_e == OrderSide.BUY and price <= limit_price) or
                          (side_e == OrderSide.SELL and price >= limit_price))
            if not marketable:
                db.commit()
                db.refresh(order)
                return self._order_dict(order)
            price = limit_price

        self._execute_fill(db, acc, order, price)
        db.commit()
        db.refresh(order)
        return self._order_dict(order)

    def _execute_fill(self, db: Session, acc: BrokerAccount, order: Order, price: float):
        """Apply a fill: update cash, position (signed), realized P&L. Validates funds."""
        signed = order.qty if order.side == OrderSide.BUY else -order.qty
        pos = self._position(db, acc, order.symbol)
        old_qty, old_avg = pos.qty, pos.avg_price

        # ---- risk checks ----
        cost = order.qty * price
        if order.side == OrderSide.BUY and acc.cash_balance < cost - 1e-9 \
                and (old_qty >= 0):
            order.status = OrderStatus.REJECTED
            order.note = "insufficient buying power"
            raise HTTPException(400, "Insufficient buying power for this order")
        # cap naked short exposure to the starting balance
        new_qty_preview = old_qty + signed
        if new_qty_preview < 0 and abs(new_qty_preview) * price > acc.starting_balance + 1e-6:
            order.status = OrderStatus.REJECTED
            order.note = "short exposure cap exceeded"
            raise HTTPException(400, "Short exposure would exceed the account cap")

        realized = 0.0
        # same direction or opening from flat -> weighted average
        if old_qty == 0 or (old_qty > 0) == (signed > 0):
            total = abs(old_qty) + abs(signed)
            pos.avg_price = (abs(old_qty) * old_avg + abs(signed) * price) / total
            pos.qty = old_qty + signed
        else:
            # opposite direction -> close (and maybe flip)
            closing = min(abs(signed), abs(old_qty))
            sign_old = 1 if old_qty > 0 else -1
            realized = closing * (price - old_avg) * sign_old
            if abs(signed) <= abs(old_qty):
                pos.qty = old_qty + signed            # reduced, avg unchanged
            else:
                pos.qty = old_qty + signed            # flipped
                pos.avg_price = price                 # new basis at fill price

        # cash moves opposite to signed exposure
        acc.cash_balance -= signed * price
        acc.realized_pnl += realized
        pos.updated_at = datetime.utcnow()

        order.status = OrderStatus.FILLED
        order.filled_price = price
        order.realized_pnl = realized
        order.filled_at = datetime.utcnow()

    async def _fill_pending(self, db: Session, acc: BrokerAccount):
        """Opportunistically fill resting limit orders that have become marketable."""
        pend = [o for o in acc.orders if o.status == OrderStatus.PENDING]
        changed = False
        for o in pend:
            price = await mkt.get_price(o.symbol)
            if price is None:
                continue
            hit = ((o.side == OrderSide.BUY and price <= o.limit_price) or
                   (o.side == OrderSide.SELL and price >= o.limit_price))
            if hit:
                try:
                    self._execute_fill(db, acc, o, o.limit_price)
                    changed = True
                except HTTPException:
                    o.status = OrderStatus.REJECTED
                    changed = True
        if changed:
            db.commit()

    async def list_orders(self, db: Session, user: User, limit: int = 50) -> list[dict]:
        acc = self._account(db, user)
        orders = (db.query(Order).filter(Order.account_id == acc.id)
                    .order_by(Order.created_at.desc()).limit(limit).all())
        return [self._order_dict(o) for o in orders]

    async def cancel_order(self, db: Session, user: User, order_id) -> dict:
        try:
            order_id = int(order_id)
        except (TypeError, ValueError):
            raise HTTPException(400, "Invalid order id")
        acc = self._account(db, user)
        o = (db.query(Order).filter(Order.id == order_id,
                                    Order.account_id == acc.id).first())
        if not o:
            raise HTTPException(404, "Order not found")
        if o.status != OrderStatus.PENDING:
            raise HTTPException(400, f"Cannot cancel a {o.status.value} order")
        o.status = OrderStatus.CANCELLED
        db.commit()
        db.refresh(o)
        return self._order_dict(o)

    @staticmethod
    def _order_dict(o: Order) -> dict:
        return {
            "id": o.id, "symbol": o.symbol, "side": o.side.value,
            "type": o.type.value, "qty": o.qty, "limit_price": o.limit_price,
            "status": o.status.value, "filled_price": o.filled_price,
            "realized_pnl": round(o.realized_pnl, 2), "note": o.note,
            "created_at": o.created_at.isoformat(),
            "filled_at": o.filled_at.isoformat() if o.filled_at else None,
        }


# ============================================================
#  Alpaca broker (real execution; paper endpoint by default)
# ============================================================
class AlpacaBroker:
    name = "alpaca"

    def __init__(self):
        self.base = settings.ALPACA_BASE_URL.rstrip("/")
        self.headers = {
            "APCA-API-KEY-ID": settings.ALPACA_API_KEY,
            "APCA-API-SECRET-KEY": settings.ALPACA_API_SECRET,
        }
        self.is_live = "paper-api" not in self.base

    @staticmethod
    def _sym(symbol: str) -> str:
        inst = get_instrument(symbol)
        if not inst:
            raise HTTPException(400, f"Unknown instrument: {symbol}")
        if inst["asset_class"] == "stocks":
            return symbol.upper()
        if inst["asset_class"] == "crypto" and len(symbol) == 6:
            return f"{symbol[:3].upper()}/{symbol[3:].upper()}"
        raise HTTPException(400,
            f"{symbol} is not tradable via Alpaca (stocks & crypto only)")

    async def _req(self, method: str, path: str, **kw):
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.request(method, f"{self.base}{path}",
                                     headers=self.headers, **kw)
            if r.status_code >= 400:
                raise HTTPException(r.status_code, f"Alpaca: {r.text[:200]}")
            return r.json() if r.text else {}

    async def get_account(self, db: Session, user: User) -> dict:
        a = await self._req("GET", "/v2/account")
        equity = float(a.get("equity") or 0)
        last = float(a.get("last_equity") or equity)
        return {
            "broker": "alpaca", "currency": a.get("currency", "USD"),
            "cash": round(float(a.get("cash") or 0), 2),
            "equity": round(equity, 2),
            "market_value": round(float(a.get("long_market_value") or 0) +
                                  float(a.get("short_market_value") or 0), 2),
            "starting_balance": round(last, 2),
            "realized_pnl": 0.0,
            "unrealized_pnl": round(equity - last, 2),
            "total_return_pct": round((equity - last) / last * 100 if last else 0, 2),
            "open_positions": None,
            "buying_power": round(float(a.get("buying_power") or 0), 2),
            "is_live": self.is_live,
        }

    async def get_positions(self, db: Session, user: User) -> list[dict]:
        rows = await self._req("GET", "/v2/positions")
        out = []
        for p in rows:
            qty = float(p["qty"])
            out.append({
                "symbol": p["symbol"], "display": p["symbol"],
                "side": p.get("side", "long"),
                "qty": qty, "avg_price": round(float(p["avg_entry_price"]), 6),
                "current_price": round(float(p.get("current_price") or 0), 6),
                "market_value": round(float(p.get("market_value") or 0), 2),
                "unrealized_pnl": round(float(p.get("unrealized_pl") or 0), 2),
                "unrealized_pct": round(float(p.get("unrealized_plpc") or 0) * 100, 2),
            })
        return out

    async def place_order(self, db: Session, user: User, symbol: str, side: str,
                          qty: float, order_type: str = "market",
                          limit_price: float | None = None,
                          note: str | None = None) -> dict:
        body = {
            "symbol": self._sym(symbol), "qty": str(qty), "side": side.lower(),
            "type": order_type.lower(), "time_in_force": "gtc",
        }
        if order_type.lower() == "limit":
            body["limit_price"] = str(limit_price)
        o = await self._req("POST", "/v2/orders", json=body)
        return self._order_dict(o)

    async def list_orders(self, db: Session, user: User, limit: int = 50) -> list[dict]:
        rows = await self._req("GET", "/v2/orders",
                               params={"status": "all", "limit": limit})
        return [self._order_dict(o) for o in rows]

    async def cancel_order(self, db: Session, user: User, order_id) -> dict:
        await self._req("DELETE", f"/v2/orders/{order_id}")
        return {"id": order_id, "status": "cancelled"}

    @staticmethod
    def _order_dict(o: dict) -> dict:
        return {
            "id": o.get("id"), "symbol": o.get("symbol"), "side": o.get("side"),
            "type": o.get("type") or o.get("order_type"), "qty": float(o.get("qty") or 0),
            "limit_price": float(o["limit_price"]) if o.get("limit_price") else None,
            "status": o.get("status"),
            "filled_price": float(o["filled_avg_price"]) if o.get("filled_avg_price") else None,
            "realized_pnl": 0.0, "note": None,
            "created_at": o.get("created_at"), "filled_at": o.get("filled_at"),
        }


# ============================================================
#  OANDA broker (real forex + metals execution; practice by default)
# ============================================================
class OandaBroker:
    name = "oanda"

    # internal symbol -> OANDA v20 instrument
    _MAP = {
        "US30": "US30_USD", "NAS100": "NAS100_USD", "SPX500": "SPX500_USD",
        "GER40": "DE30_EUR", "UK100": "UK100_GBP", "JP225": "JP225_USD",
        "WTIUSD": "WTICO_USD", "XBRUSD": "BCO_USD",
    }

    def __init__(self):
        host = ("api-fxtrade.oanda.com" if settings.OANDA_ENVIRONMENT == "live"
                else "api-fxpractice.oanda.com")
        self.base = f"https://{host}"
        self.account = settings.OANDA_ACCOUNT_ID
        self.headers = {"Authorization": f"Bearer {settings.OANDA_API_TOKEN}",
                        "Content-Type": "application/json"}
        self.is_live = settings.OANDA_ENVIRONMENT == "live"

    def _inst(self, symbol: str) -> str:
        symbol = symbol.upper()
        inst = get_instrument(symbol)
        if not inst:
            raise HTTPException(400, f"Unknown instrument: {symbol}")
        if inst["asset_class"] in ("forex", "metals") and len(symbol) == 6:
            return f"{symbol[:3]}_{symbol[3:]}"
        if symbol in self._MAP:
            return self._MAP[symbol]
        raise HTTPException(400,
            f"{symbol} is not tradable via OANDA (forex, metals, major indices & energy)")

    @staticmethod
    def _to_symbol(instrument: str) -> str:
        rev = {v: k for k, v in OandaBroker._MAP.items()}
        if instrument in rev:
            return rev[instrument]
        return instrument.replace("_", "")

    async def _req(self, method: str, path: str, **kw):
        if not self.account:
            raise HTTPException(500, "OANDA_ACCOUNT_ID not configured")
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.request(method, f"{self.base}{path}",
                                     headers=self.headers, **kw)
            if r.status_code >= 400:
                raise HTTPException(r.status_code, f"OANDA: {r.text[:200]}")
            return r.json() if r.text else {}

    async def get_account(self, db: Session, user: User) -> dict:
        d = (await self._req("GET", f"/v3/accounts/{self.account}/summary"))["account"]
        balance = float(d.get("balance") or 0)
        nav = float(d.get("NAV") or balance)
        upl = float(d.get("unrealizedPL") or 0)
        realized = float(d.get("pl") or 0)              # lifetime realized
        starting = balance - realized or balance
        return {
            "broker": "oanda", "currency": d.get("currency", "USD"),
            "cash": round(balance, 2), "equity": round(nav, 2),
            "market_value": round(nav - balance, 2),
            "starting_balance": round(starting, 2),
            "realized_pnl": round(realized, 2),
            "unrealized_pnl": round(upl, 2),
            "total_return_pct": round((nav - starting) / starting * 100 if starting else 0, 2),
            "open_positions": int(d.get("openPositionCount") or 0),
            "buying_power": round(float(d.get("marginAvailable") or 0), 2),
            "is_live": self.is_live,
        }

    async def get_positions(self, db: Session, user: User) -> list[dict]:
        rows = (await self._req("GET",
                f"/v3/accounts/{self.account}/openPositions")).get("positions", [])
        out = []
        for p in rows:
            long_u = float(p.get("long", {}).get("units") or 0)
            short_u = float(p.get("short", {}).get("units") or 0)
            net = long_u + short_u
            if abs(net) < 1e-9:
                continue
            leg = p["long"] if net > 0 else p["short"]
            avg = float(leg.get("averagePrice") or 0)
            upl = float(p.get("unrealizedPL") or 0)
            cost = abs(net) * avg
            sym = self._to_symbol(p["instrument"])
            inst = get_instrument(sym)
            out.append({
                "symbol": sym, "display": inst["display"] if inst else sym,
                "side": "long" if net > 0 else "short",
                "qty": net, "avg_price": round(avg, 6),
                "current_price": round(avg + (upl / net if net else 0), 6),
                "market_value": round(cost, 2),
                "unrealized_pnl": round(upl, 2),
                "unrealized_pct": round((upl / cost * 100) if cost else 0, 2),
            })
        return out

    async def place_order(self, db: Session, user: User, symbol: str, side: str,
                          qty: float, order_type: str = "market",
                          limit_price: float | None = None,
                          note: str | None = None) -> dict:
        units = qty if side.lower() == "buy" else -qty
        order = {"instrument": self._inst(symbol), "units": str(units)}
        if order_type.lower() == "limit":
            order.update(type="LIMIT", price=str(limit_price), timeInForce="GTC")
        else:
            order.update(type="MARKET", timeInForce="FOK", positionFill="DEFAULT")
        resp = await self._req("POST", f"/v3/accounts/{self.account}/orders",
                               json={"order": order})
        return self._order_dict(resp, symbol)

    async def list_orders(self, db: Session, user: User, limit: int = 50) -> list[dict]:
        rows = (await self._req("GET",
                f"/v3/accounts/{self.account}/orders",
                params={"state": "ALL", "count": limit})).get("orders", [])
        out = []
        for o in rows:
            out.append({
                "id": o.get("id"),
                "symbol": self._to_symbol(o.get("instrument", "")),
                "side": "buy" if float(o.get("units") or 0) >= 0 else "sell",
                "type": (o.get("type") or "").lower(),
                "qty": abs(float(o.get("units") or 0)),
                "limit_price": float(o["price"]) if o.get("price") else None,
                "status": (o.get("state") or "").lower(),
                "filled_price": None, "realized_pnl": 0.0, "note": None,
                "created_at": o.get("createTime"), "filled_at": None,
            })
        return out

    async def cancel_order(self, db: Session, user: User, order_id) -> dict:
        await self._req("PUT", f"/v3/accounts/{self.account}/orders/{order_id}/cancel")
        return {"id": order_id, "status": "cancelled"}

    @staticmethod
    def _order_dict(resp: dict, symbol: str) -> dict:
        fill = resp.get("orderFillTransaction")
        create = resp.get("orderCreateTransaction") or {}
        if fill:
            return {
                "id": fill.get("orderID") or fill.get("id"), "symbol": symbol,
                "side": "buy" if float(fill.get("units") or 0) >= 0 else "sell",
                "type": "market", "qty": abs(float(fill.get("units") or 0)),
                "limit_price": None, "status": "filled",
                "filled_price": float(fill["price"]) if fill.get("price") else None,
                "realized_pnl": float(fill.get("pl") or 0), "note": None,
                "created_at": fill.get("time"), "filled_at": fill.get("time"),
            }
        return {
            "id": create.get("id"), "symbol": symbol,
            "side": "buy" if float(create.get("units") or 0) >= 0 else "sell",
            "type": (create.get("type") or "limit").lower(),
            "qty": abs(float(create.get("units") or 0)),
            "limit_price": float(create["price"]) if create.get("price") else None,
            "status": "pending", "filled_price": None, "realized_pnl": 0.0,
            "note": None, "created_at": create.get("time"), "filled_at": None,
        }


# ============================================================
#  Multi-venue router (forex/metals -> OANDA, stocks/crypto -> Alpaca, else paper)
# ============================================================
def _alpaca_ready() -> bool:
    return bool(settings.ALPACA_API_KEY and settings.ALPACA_API_SECRET)


def _oanda_ready() -> bool:
    return bool(settings.OANDA_API_TOKEN and settings.OANDA_ACCOUNT_ID)


class RoutingBroker:
    """Runs several venues at once and sends each order to the right one based on
    the instrument's asset class. Falls back to the paper broker for any class
    whose live venue isn't configured. Account/positions/orders are aggregated
    across venues; order ids are namespaced 'venue:id' so cancels route back."""
    name = "router"

    def __init__(self):
        self.paper = _paper
        self.alpaca = AlpacaBroker() if _alpaca_ready() else None
        self.oanda = OandaBroker() if _oanda_ready() else None
        self.is_live = bool((self.alpaca and self.alpaca.is_live) or
                            (self.oanda and self.oanda.is_live))

    # ---- routing ----
    def _venue(self, symbol: str):
        inst = get_instrument(symbol)
        if not inst:
            raise HTTPException(400, f"Unknown instrument: {symbol}")
        ac = inst["asset_class"]
        if ac in ("forex", "metals", "indices", "energy") and self.oanda:
            return "oanda", self.oanda
        if ac in ("stocks", "crypto") and self.alpaca:
            return "alpaca", self.alpaca
        return "paper", self.paper

    def _participating(self) -> list[tuple[str, object]]:
        venues = [("paper", self.paper)]
        if self.alpaca:
            venues.append(("alpaca", self.alpaca))
        if self.oanda:
            venues.append(("oanda", self.oanda))
        return venues

    def venue_map(self) -> dict:
        return {
            "forex": "oanda" if self.oanda else "paper",
            "metals": "oanda" if self.oanda else "paper",
            "indices": "oanda" if self.oanda else "paper",
            "energy": "oanda" if self.oanda else "paper",
            "stocks": "alpaca" if self.alpaca else "paper",
            "crypto": "alpaca" if self.alpaca else "paper",
        }

    @staticmethod
    def _idle_paper(acc: dict) -> bool:
        return (acc["realized_pnl"] == 0 and acc["unrealized_pnl"] == 0 and
                (acc["open_positions"] or 0) == 0 and
                abs(acc["cash"] - acc["starting_balance"]) < 1e-6)

    # ---- aggregate views ----
    async def get_account(self, db: Session, user: User) -> dict:
        venues = self._participating()
        has_live = bool(self.alpaca or self.oanda)
        agg = {"cash": 0.0, "equity": 0.0, "market_value": 0.0,
               "starting_balance": 0.0, "realized_pnl": 0.0,
               "unrealized_pnl": 0.0, "buying_power": 0.0, "open_positions": 0}
        breakdown = []
        for vname, vb in venues:
            try:
                a = await vb.get_account(db, user)
            except HTTPException as e:
                breakdown.append({"venue": vname, "error": e.detail})
                continue
            # skip an untouched paper book when real venues are active
            if vname == "paper" and has_live and self._idle_paper(a):
                continue
            breakdown.append({"venue": vname, **a})
            for k in agg:
                if k == "open_positions":
                    agg[k] += a.get("open_positions") or 0
                else:
                    agg[k] += a.get(k) or 0.0
        start = agg["starting_balance"]
        agg["total_return_pct"] = round((agg["equity"] - start) / start * 100, 2) if start else 0.0
        for k in ("cash", "equity", "market_value", "starting_balance",
                  "realized_pnl", "unrealized_pnl", "buying_power"):
            agg[k] = round(agg[k], 2)
        agg.update(broker="router", currency="USD", is_live=self.is_live,
                   venues=breakdown)
        return agg

    async def get_positions(self, db: Session, user: User) -> list[dict]:
        out = []
        for vname, vb in self._participating():
            try:
                for p in await vb.get_positions(db, user):
                    out.append({**p, "venue": vname})
            except HTTPException:
                continue
        return out

    async def list_orders(self, db: Session, user: User, limit: int = 50) -> list[dict]:
        out = []
        for vname, vb in self._participating():
            try:
                for o in await vb.list_orders(db, user, limit):
                    out.append({**o, "venue": vname, "id": f"{vname}:{o['id']}"})
            except HTTPException:
                continue
        out.sort(key=lambda o: o.get("created_at") or "", reverse=True)
        return out[:limit]

    async def place_order(self, db: Session, user: User, symbol: str, side: str,
                          qty: float, order_type: str = "market",
                          limit_price: float | None = None,
                          note: str | None = None) -> dict:
        vname, vb = self._venue(symbol)
        o = await vb.place_order(db, user, symbol, side, qty, order_type,
                                 limit_price, note)
        return {**o, "venue": vname, "id": f"{vname}:{o['id']}"}

    async def cancel_order(self, db: Session, user: User, order_id) -> dict:
        if isinstance(order_id, str) and ":" in order_id:
            vname, raw = order_id.split(":", 1)
        else:
            vname, raw = "paper", order_id
        vb = {"paper": self.paper, "alpaca": self.alpaca,
              "oanda": self.oanda}.get(vname)
        if not vb:
            raise HTTPException(400, f"Venue '{vname}' is not active")
        r = await vb.cancel_order(db, user, raw)
        return {**r, "venue": vname, "id": order_id}


_paper = PaperBroker()
_alpaca: AlpacaBroker | None = None
_oanda: OandaBroker | None = None
_router: "RoutingBroker | None" = None


def get_broker():
    """Active broker. Falls back to the safe paper broker if the chosen live
    broker isn't fully configured."""
    global _alpaca, _oanda, _router
    if settings.BROKER == "router":
        if _router is None:
            _router = RoutingBroker()
        return _router
    if settings.BROKER == "alpaca" and _alpaca_ready():
        if _alpaca is None:
            _alpaca = AlpacaBroker()
        return _alpaca
    if settings.BROKER == "oanda" and _oanda_ready():
        if _oanda is None:
            _oanda = OandaBroker()
        return _oanda
    return _paper
