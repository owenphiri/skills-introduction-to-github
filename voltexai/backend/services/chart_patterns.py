"""
VoltexAI Chart Patterns — detects classic chart patterns on a candle series and
returns a full visual trade plan (entry, SL, TP1–TP3, break-even) plus the
geometry the frontend needs to draw pattern points and level lines on the chart.

Deterministic and dependency-free; works on the synthetic feed and any real
vendor candles. Educational analysis, not financial advice.
"""
from __future__ import annotations


def _pivots(highs: list[float], lows: list[float], w: int = 2) -> tuple[list[int], list[int]]:
    ph, pl = [], []
    n = len(highs)
    for i in range(w, n - w):
        seg_h = highs[i - w:i + w + 1]
        seg_l = lows[i - w:i + w + 1]
        if highs[i] == max(seg_h) and seg_h.count(highs[i]) == 1:
            ph.append(i)
        if lows[i] == min(seg_l) and seg_l.count(lows[i]) == 1:
            pl.append(i)
    return ph, pl


def _atr(candles: list[dict], n: int = 14) -> float:
    trs = []
    for i in range(1, len(candles)):
        h, l, pc = candles[i]["high"], candles[i]["low"], candles[i - 1]["close"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    if not trs:
        return 0.0
    return sum(trs[-n:]) / len(trs[-n:])


def _close(v: float, ref: float, tol: float) -> bool:
    return abs(v - ref) <= tol


def _plan(direction: str, entry: float, sl: float, height: float, dp: int) -> dict:
    """Build entry/SL/TP1-3/BE from an invalidation stop + a measured-move target."""
    risk = abs(entry - sl)
    sign = 1 if direction == "buy" else -1
    # TP1/TP2 at 1R/2R, TP3 at the measured move (pattern height) or 3R, whichever is larger
    mm = max(height, risk * 3)
    tp1 = entry + sign * risk
    tp2 = entry + sign * risk * 2
    tp3 = entry + sign * mm
    rr = round(abs(tp3 - entry) / risk, 2) if risk else 0
    r = lambda x: round(x, dp)
    return {"direction": direction, "entry": r(entry), "sl": r(sl),
            "tp1": r(tp1), "tp2": r(tp2), "tp3": r(tp3), "be": r(entry),
            "risk": r(risk), "rr": rr,
            "management": "TP1 → secure partial · TP2 → move SL to break-even (BE) · TP3 → trail the runner."}


def detect(candles: list[dict], dp: int = 5) -> dict:
    n = len(candles)
    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    closes = [c["close"] for c in candles]
    price = closes[-1]
    atr = _atr(candles) or (price * 0.001)
    tol = atr * 0.6
    ph, pl = _pivots(highs, lows)

    support = round(min(lows[-40:]), dp)
    resistance = round(max(highs[-40:]), dp)
    sma_fast = sum(closes[-10:]) / min(10, n)
    sma_slow = sum(closes[-30:]) / min(30, n)
    trend = "up" if sma_fast > sma_slow else "down"

    pattern = None
    plan = None

    # ---- Triple Top / Triple Bottom (three equal extremes) ----
    if len(ph) >= 3:
        a, b, c = ph[-3], ph[-2], ph[-1]
        if _close(highs[a], highs[b], tol) and _close(highs[b], highs[c], tol):
            troughs = [i for i in pl if a < i < c]
            if troughs:
                neck = min(lows[t] for t in troughs)
                top = max(highs[a], highs[b], highs[c])
                entry, sl = neck - tol * 0.25, top + tol * 0.5
                pattern = {"name": "Triple Top", "type": "bearish", "confidence": 84,
                           "description": "Three equal highs rejected at resistance; breaking the neckline is a strong reversal signal.",
                           "points": [{"i": a, "price": round(highs[a], dp), "label": "Top 1"},
                                      {"i": b, "price": round(highs[b], dp), "label": "Top 2"},
                                      {"i": c, "price": round(highs[c], dp), "label": "Top 3"}],
                           "neckline": round(neck, dp)}
                plan = _plan("sell", entry, sl, top - neck, dp)
    if pattern is None and len(pl) >= 3:
        a, b, c = pl[-3], pl[-2], pl[-1]
        if _close(lows[a], lows[b], tol) and _close(lows[b], lows[c], tol):
            peaks = [i for i in ph if a < i < c]
            if peaks:
                neck = max(highs[p] for p in peaks)
                bottom = min(lows[a], lows[b], lows[c])
                entry, sl = neck + tol * 0.25, bottom - tol * 0.5
                pattern = {"name": "Triple Bottom", "type": "bullish", "confidence": 84,
                           "description": "Three equal lows held at support; breaking the neckline is a strong reversal signal.",
                           "points": [{"i": a, "price": round(lows[a], dp), "label": "Bottom 1"},
                                      {"i": b, "price": round(lows[b], dp), "label": "Bottom 2"},
                                      {"i": c, "price": round(lows[c], dp), "label": "Bottom 3"}],
                           "neckline": round(neck, dp)}
                plan = _plan("buy", entry, sl, neck - bottom, dp)

    # ---- Rectangle / range consolidation (flat top & flat bottom) ----
    if pattern is None and len(ph) >= 2 and len(pl) >= 2:
        h1, h2 = highs[ph[-2]], highs[ph[-1]]
        l1, l2 = lows[pl[-2]], lows[pl[-1]]
        if _close(h1, h2, tol) and _close(l1, l2, tol) and (h1 - l1) > atr * 2.2:
            res, sup = (h1 + h2) / 2, (l1 + l2) / 2
            height = res - sup
            if price - sup < res - price:                        # nearer support -> long the range
                entry, sl, direction = sup + tol * 0.5, sup - tol, "buy"
            else:
                entry, sl, direction = res - tol * 0.5, res + tol, "sell"
            pattern = {"name": "Rectangle", "type": "bullish" if direction == "buy" else "bearish",
                       "confidence": 66,
                       "description": "Price consolidating between horizontal support and resistance — fade the bands or trade the eventual breakout.",
                       "points": [{"i": ph[-1], "price": round(res, dp), "label": "Resistance"},
                                  {"i": pl[-1], "price": round(sup, dp), "label": "Support"}],
                       "neckline": round(res if direction == "sell" else sup, dp)}
            plan = _plan(direction, entry, sl, height, dp)

    # ---- Double Top (bearish) ----
    if pattern is None and len(ph) >= 2 and len(pl) >= 1:
        a, b = ph[-2], ph[-1]
        troughs = [i for i in pl if a < i < b]
        if troughs and _close(highs[a], highs[b], tol):
            neck = lows[troughs[0]]
            top = max(highs[a], highs[b])
            height = top - neck
            entry = neck - tol * 0.25
            sl = top + tol * 0.5
            pattern = {"name": "Double Top", "type": "bearish", "confidence": 78,
                       "description": "Two equal highs rejected at resistance; a break of the neckline confirms a reversal lower.",
                       "points": [{"i": a, "price": round(highs[a], dp), "label": "Top 1"},
                                  {"i": b, "price": round(highs[b], dp), "label": "Top 2"},
                                  {"i": troughs[0], "price": round(neck, dp), "label": "Neckline"}],
                       "neckline": round(neck, dp)}
            plan = _plan("sell", entry, sl, height, dp)

    # ---- Double Bottom (bullish) ----
    if pattern is None and len(pl) >= 2 and len(ph) >= 1:
        a, b = pl[-2], pl[-1]
        peaks = [i for i in ph if a < i < b]
        if peaks and _close(lows[a], lows[b], tol):
            neck = highs[peaks[0]]
            bottom = min(lows[a], lows[b])
            height = neck - bottom
            entry = neck + tol * 0.25
            sl = bottom - tol * 0.5
            pattern = {"name": "Double Bottom", "type": "bullish", "confidence": 78,
                       "description": "Two equal lows held at support; a break of the neckline confirms a reversal higher.",
                       "points": [{"i": a, "price": round(lows[a], dp), "label": "Bottom 1"},
                                  {"i": b, "price": round(lows[b], dp), "label": "Bottom 2"},
                                  {"i": peaks[0], "price": round(neck, dp), "label": "Neckline"}],
                       "neckline": round(neck, dp)}
            plan = _plan("buy", entry, sl, height, dp)

    # ---- Head & Shoulders / Inverse ----
    if pattern is None and len(ph) >= 3 and len(pl) >= 2:
        l, h, r = ph[-3], ph[-2], ph[-1]
        if highs[h] > highs[l] and highs[h] > highs[r] and _close(highs[l], highs[r], tol * 1.5):
            necks = [lows[i] for i in pl if l < i < r]
            if necks:
                neck = sum(necks) / len(necks)
                height = highs[h] - neck
                entry = neck - tol * 0.25
                sl = highs[h] + tol * 0.5
                pattern = {"name": "Head & Shoulders", "type": "bearish", "confidence": 82,
                           "description": "A higher central peak (head) between two lower peaks (shoulders); breaking the neckline targets the head's height projected down.",
                           "points": [{"i": l, "price": round(highs[l], dp), "label": "L. Shoulder"},
                                      {"i": h, "price": round(highs[h], dp), "label": "Head"},
                                      {"i": r, "price": round(highs[r], dp), "label": "R. Shoulder"}],
                           "neckline": round(neck, dp)}
                plan = _plan("sell", entry, sl, height, dp)
    if pattern is None and len(pl) >= 3 and len(ph) >= 2:
        l, h, r = pl[-3], pl[-2], pl[-1]
        if lows[h] < lows[l] and lows[h] < lows[r] and _close(lows[l], lows[r], tol * 1.5):
            necks = [highs[i] for i in ph if l < i < r]
            if necks:
                neck = sum(necks) / len(necks)
                height = neck - lows[h]
                entry = neck + tol * 0.25
                sl = lows[h] - tol * 0.5
                pattern = {"name": "Inverse Head & Shoulders", "type": "bullish", "confidence": 82,
                           "description": "A lower central trough (head) between two higher troughs; breaking the neckline targets the head's height projected up.",
                           "points": [{"i": l, "price": round(lows[l], dp), "label": "L. Shoulder"},
                                      {"i": h, "price": round(lows[h], dp), "label": "Head"},
                                      {"i": r, "price": round(lows[r], dp), "label": "R. Shoulder"}],
                           "neckline": round(neck, dp)}
                plan = _plan("buy", entry, sl, height, dp)

    # ---- Ascending / Descending triangle ----
    if pattern is None and len(ph) >= 2 and len(pl) >= 2:
        h1, h2 = highs[ph[-2]], highs[ph[-1]]
        l1, l2 = lows[pl[-2]], lows[pl[-1]]
        if _close(h1, h2, tol) and l2 > l1 + tol * 0.3:            # flat top, rising lows
            entry = max(h1, h2) + tol * 0.25
            sl = l2 - tol * 0.5
            pattern = {"name": "Ascending Triangle", "type": "bullish", "confidence": 72,
                       "description": "Flat resistance with rising lows — buyers stepping up; a break of resistance targets the triangle's height.",
                       "points": [{"i": ph[-1], "price": round(h2, dp), "label": "Resistance"},
                                  {"i": pl[-1], "price": round(l2, dp), "label": "Rising low"}],
                       "neckline": round(max(h1, h2), dp)}
            plan = _plan("buy", entry, sl, max(h1, h2) - l1, dp)
        elif _close(l1, l2, tol) and h2 < h1 - tol * 0.3:          # flat bottom, falling highs
            entry = min(l1, l2) - tol * 0.25
            sl = h2 + tol * 0.5
            pattern = {"name": "Descending Triangle", "type": "bearish", "confidence": 72,
                       "description": "Flat support with falling highs — sellers pressing; a break of support targets the triangle's height.",
                       "points": [{"i": pl[-1], "price": round(l2, dp), "label": "Support"},
                                  {"i": ph[-1], "price": round(h2, dp), "label": "Falling high"}],
                       "neckline": round(min(l1, l2), dp)}
            plan = _plan("sell", entry, sl, h1 - min(l1, l2), dp)

    # ---- Bull / Bear Flag (strong pole + tight counter-trend consolidation) ----
    if pattern is None and n >= 32:
        M = 10                                   # consolidation window (the flag)
        cons = candles[-M:]
        cons_hi = max(c["high"] for c in cons)
        cons_lo = min(c["low"] for c in cons)
        cons_range = cons_hi - cons_lo
        pole = candles[-(M + 18):-M]
        if pole:
            pole_move = pole[-1]["close"] - pole[0]["close"]
            pole_height = max(c["high"] for c in pole) - min(c["low"] for c in pole)
            if abs(pole_move) > atr * 3 and 0 < cons_range < pole_height * 0.6:
                flag_i, pole_i = n - M, n - (M + 18)
                # pennant if the consolidation is converging, else a (parallel) flag
                r1 = max(c["high"] for c in cons[:M // 2]) - min(c["low"] for c in cons[:M // 2])
                r2 = max(c["high"] for c in cons[M // 2:]) - min(c["low"] for c in cons[M // 2:])
                pennant = r2 < r1 * 0.7
                if pole_move > 0:                # bullish continuation
                    entry, sl = cons_hi + tol * 0.25, cons_lo - tol * 0.5
                    name = "Bull Pennant" if pennant else "Bull Flag"
                    desc = ("A strong up-impulse (pole) then a small symmetrical "
                            "consolidation (pennant); a break higher targets the pole's height."
                            if pennant else
                            "A strong up-impulse (pole) then a tight pullback (flag); a break "
                            "above the flag targets the pole's height projected up.")
                    pattern = {"name": name, "type": "bullish", "confidence": 76,
                               "description": desc,
                               "points": [{"i": pole_i, "price": round(pole[0]["close"], dp), "label": "Pole"},
                                          {"i": flag_i, "price": round(cons_hi, dp), "label": name.split()[1]}],
                               "neckline": round(cons_hi, dp)}
                    plan = _plan("buy", entry, sl, pole_height, dp)
                else:                            # bearish continuation
                    entry, sl = cons_lo - tol * 0.25, cons_hi + tol * 0.5
                    name = "Bear Pennant" if pennant else "Bear Flag"
                    desc = ("A strong down-impulse (pole) then a small symmetrical "
                            "consolidation (pennant); a break lower targets the pole's height."
                            if pennant else
                            "A strong down-impulse (pole) then a tight bounce (flag); a break "
                            "below the flag targets the pole's height projected down.")
                    pattern = {"name": name, "type": "bearish", "confidence": 76,
                               "description": desc,
                               "points": [{"i": pole_i, "price": round(pole[0]["close"], dp), "label": "Pole"},
                                          {"i": flag_i, "price": round(cons_lo, dp), "label": name.split()[1]}],
                               "neckline": round(cons_lo, dp)}
                    plan = _plan("sell", entry, sl, pole_height, dp)

    # ---- Rising / Falling Wedge (both lines slope the same way, converging) ----
    if pattern is None and len(ph) >= 2 and len(pl) >= 2:
        h1, h2 = highs[ph[-2]], highs[ph[-1]]
        l1, l2 = lows[pl[-2]], lows[pl[-1]]
        range1, range2 = h1 - l1, h2 - l2
        converging = 0 < range2 < range1 * 0.85
        if converging and h2 > h1 + tol * 0.2 and l2 > l1 + tol * 0.2:   # rising wedge -> bearish
            entry, sl = l2 - tol * 0.25, h2 + tol * 0.5
            pattern = {"name": "Rising Wedge", "type": "bearish", "confidence": 70,
                       "description": "Rising but converging highs and lows — momentum fading; a break of the lower line resolves lower.",
                       "points": [{"i": ph[-1], "price": round(h2, dp), "label": "Upper"},
                                  {"i": pl[-1], "price": round(l2, dp), "label": "Lower"}],
                       "neckline": round(l2, dp)}
            plan = _plan("sell", entry, sl, range1, dp)
        elif converging and h2 < h1 - tol * 0.2 and l2 < l1 - tol * 0.2:  # falling wedge -> bullish
            entry, sl = h2 + tol * 0.25, l2 - tol * 0.5
            pattern = {"name": "Falling Wedge", "type": "bullish", "confidence": 70,
                       "description": "Falling but converging highs and lows — selling pressure fading; a break of the upper line resolves higher.",
                       "points": [{"i": ph[-1], "price": round(h2, dp), "label": "Upper"},
                                  {"i": pl[-1], "price": round(l2, dp), "label": "Lower"}],
                       "neckline": round(h2, dp)}
            plan = _plan("buy", entry, sl, range1, dp)

    # ---- Ascending / Descending channel (parallel sloping trend lines) ----
    if pattern is None and len(ph) >= 2 and len(pl) >= 2:
        h1, h2 = highs[ph[-2]], highs[ph[-1]]
        l1, l2 = lows[pl[-2]], lows[pl[-1]]
        parallel = abs((h2 - l2) - (h1 - l1)) < atr * 0.9
        if parallel and h2 > h1 + tol * 0.3 and l2 > l1 + tol * 0.3:   # ascending channel
            entry, sl = price, l2 - tol
            pattern = {"name": "Ascending Channel", "type": "bullish", "confidence": 68,
                       "description": "Higher highs and higher lows between two parallel rising lines — buy pullbacks to the lower rail while the channel holds.",
                       "points": [{"i": ph[-1], "price": round(h2, dp), "label": "Upper rail"},
                                  {"i": pl[-1], "price": round(l2, dp), "label": "Lower rail"}],
                       "neckline": round(l2, dp)}
            plan = _plan("buy", entry, sl, h1 - l1, dp)
        elif parallel and h2 < h1 - tol * 0.3 and l2 < l1 - tol * 0.3:  # descending channel
            entry, sl = price, h2 + tol
            pattern = {"name": "Descending Channel", "type": "bearish", "confidence": 68,
                       "description": "Lower highs and lower lows between two parallel falling lines — sell rallies to the upper rail while the channel holds.",
                       "points": [{"i": ph[-1], "price": round(h2, dp), "label": "Upper rail"},
                                  {"i": pl[-1], "price": round(l2, dp), "label": "Lower rail"}],
                       "neckline": round(h2, dp)}
            plan = _plan("sell", entry, sl, h1 - l1, dp)

    # ---- Fallback: trend continuation / range ----
    if pattern is None:
        rng = resistance - support
        if rng < atr * 4:                                          # tight range → bounce play
            if price - support < resistance - price:
                entry, sl, direction = support + tol, support - tol, "buy"
            else:
                entry, sl, direction = resistance - tol, resistance + tol, "sell"
            pattern = {"name": "Range / S-R Bounce", "type": "bullish" if direction == "buy" else "bearish",
                       "confidence": 60,
                       "description": "Price is ranging between support and resistance — fade the edges toward the opposite band.",
                       "points": [{"i": n - 1, "price": round(price, dp), "label": "Price"}],
                       "neckline": round(resistance if direction == "sell" else support, dp)}
            plan = _plan(direction, entry, sl, rng, dp)
        else:                                                       # trend continuation on pullback
            direction = "buy" if trend == "up" else "sell"
            if direction == "buy":
                entry = price
                sl = min(lows[-10:]) - tol
            else:
                entry = price
                sl = max(highs[-10:]) + tol
            pattern = {"name": f"{'Bullish' if direction == 'buy' else 'Bearish'} Trend Continuation",
                       "type": "bullish" if direction == "buy" else "bearish", "confidence": 64,
                       "description": f"Momentum is {'up' if direction == 'buy' else 'down'} (fast MA {'above' if trend=='up' else 'below'} slow MA); trade with trend, stop beyond the last swing.",
                       "points": [{"i": n - 1, "price": round(price, dp), "label": "Entry"}],
                       "neckline": None}
            plan = _plan(direction, entry, sl, abs(entry - sl) * 3, dp)

    # level lines for drawing (price + kind)
    lines = [
        {"price": plan["entry"], "label": "Entry", "kind": "entry"},
        {"price": plan["sl"], "label": "SL", "kind": "sl"},
        {"price": plan["be"], "label": "BE", "kind": "be"},
        {"price": plan["tp1"], "label": "TP1", "kind": "tp"},
        {"price": plan["tp2"], "label": "TP2", "kind": "tp"},
        {"price": plan["tp3"], "label": "TP3", "kind": "tp"},
    ]
    if pattern.get("neckline") is not None:
        lines.append({"price": pattern["neckline"], "label": "Neckline", "kind": "neckline"})

    return {
        "current_price": round(price, dp),
        "trend": trend, "atr": round(atr, dp),
        "support": support, "resistance": resistance,
        "pattern": pattern, "plan": plan, "lines": lines,
        "candles": [{"t": c["time"], "o": round(c["open"], dp), "h": round(c["high"], dp),
                     "l": round(c["low"], dp), "c": round(c["close"], dp)} for c in candles],
    }


def confluence(per_tf: list[dict]) -> dict:
    """Aggregate per-timeframe pattern reads into one overall bias + label."""
    if not per_tf:
        return {"score": 0, "label": "No data", "direction": "neutral",
                "bullish": 0, "bearish": 0, "agreement": 0, "timeframes": []}
    n = len(per_tf)
    score = sum((p["confidence"] if p["direction"] == "buy" else -p["confidence"]) for p in per_tf) / n
    bull = sum(1 for p in per_tf if p["direction"] == "buy")
    bear = n - bull
    if score >= 40:
        label, direction = "Strong Bullish", "buy"
    elif score >= 15:
        label, direction = "Bullish", "buy"
    elif score <= -40:
        label, direction = "Strong Bearish", "sell"
    elif score <= -15:
        label, direction = "Bearish", "sell"
    else:
        label, direction = "Mixed", "neutral"
    return {"score": round(score, 1), "label": label, "direction": direction,
            "bullish": bull, "bearish": bear,
            "agreement": round(max(bull, bear) / n * 100), "timeframes": per_tf}
