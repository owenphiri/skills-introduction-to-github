"""
VoltexAI - OANDA live price streaming
A background consumer of OANDA's v20 streaming pricing endpoint
(`/v3/accounts/{id}/pricing/stream`), which emits newline-delimited JSON PRICE and
HEARTBEAT objects over a long-lived HTTP connection.

It maintains an in-memory cache of the freshest bid / ask / mid per instrument.
`market_service` reads this cache first for forex & metals, so the markets board,
ticker and the client WebSocket all serve **real-time OANDA prices** when OANDA is
configured. The consumer auto-reconnects with backoff and is a no-op (never started)
when OANDA isn't configured, so the app still runs on the synthetic feed otherwise.

Practice host is used unless OANDA_ENVIRONMENT=live.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

import httpx

from ..config import settings
from . import data_providers as dp

logger = logging.getLogger(__name__)


class OandaPriceStream:
    def __init__(self):
        self._prices: dict[str, dict] = {}     # OANDA instrument -> {bid, ask, mid, ts}
        self._task: asyncio.Task | None = None
        self._instruments: list[str] = []
        self.connected = False
        self._stop = False

    # ---- config ----
    @staticmethod
    def configured() -> bool:
        return bool(settings.OANDA_API_TOKEN and settings.OANDA_ACCOUNT_ID)

    def _host(self) -> str:
        return ("stream-fxtrade.oanda.com" if settings.OANDA_ENVIRONMENT == "live"
                else "stream-fxpractice.oanda.com")

    # ---- lifecycle ----
    async def start(self, symbols: list[str] | None = None):
        if not self.configured() or self._task and not self._task.done():
            return
        syms = symbols or dp.oanda_streamable_symbols()
        self._instruments = [i for i in (dp.to_oanda_instrument(s) for s in syms) if i]
        if not self._instruments:
            return
        self._stop = False
        self._task = asyncio.create_task(self._run())
        logger.info("OANDA price stream starting for %d instruments (%s)",
                    len(self._instruments), self._host())

    async def stop(self):
        self._stop = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self.connected = False

    # ---- the consumer loop ----
    async def _run(self):
        url = (f"https://{self._host()}/v3/accounts/"
               f"{settings.OANDA_ACCOUNT_ID}/pricing/stream")
        headers = {"Authorization": f"Bearer {settings.OANDA_API_TOKEN}"}
        params = {"instruments": ",".join(self._instruments)}
        backoff = 1.0
        while not self._stop:
            try:
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("GET", url, headers=headers,
                                             params=params) as resp:
                        resp.raise_for_status()
                        self.connected = True
                        backoff = 1.0
                        logger.info("OANDA price stream connected")
                        async for line in resp.aiter_lines():
                            if self._stop:
                                break
                            self._ingest(line)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.connected = False
                logger.warning("OANDA stream dropped (%s); reconnecting in %.0fs",
                               e, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
        self.connected = False

    def _ingest(self, line: str):
        line = line.strip()
        if not line:
            return
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            return
        if msg.get("type") != "PRICE":
            return  # HEARTBEAT or other control message
        inst = msg.get("instrument")
        bids = msg.get("bids") or []
        asks = msg.get("asks") or []
        bid = float(bids[0]["price"]) if bids else float(msg.get("closeoutBid") or 0)
        ask = float(asks[0]["price"]) if asks else float(msg.get("closeoutAsk") or 0)
        if inst and bid and ask:
            self._prices[inst] = {"bid": bid, "ask": ask,
                                  "mid": (bid + ask) / 2.0, "ts": time.time()}

    # ---- reads ----
    def get(self, symbol: str) -> dict | None:
        inst = dp.to_oanda_instrument(symbol)
        if not inst:
            return None
        p = self._prices.get(inst)
        # treat prices older than 10s as stale (e.g. weekend / market closed)
        if p and time.time() - p["ts"] < 10.0:
            return p
        return None

    def status(self) -> dict:
        return {"configured": self.configured(), "connected": self.connected,
                "instruments": len(self._instruments),
                "live_symbols_cached": len(self._prices)}


# module singleton
oanda_stream = OandaPriceStream()
