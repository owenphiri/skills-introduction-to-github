#!/usr/bin/env python3
"""
Live Deriv smoke test for the auto-trader execution adapter.

Runs the REAL backend/services/deriv_exec.py code path against Deriv, on a DEMO
account only, so you can validate the multiplier proposal/buy/sell params before
ever enabling live auto-trading.

It: authorizes -> asserts the account is virtual (demo) -> buys ONE small
multiplier contract -> reads the fill -> sells it to close. Nothing is left open.

Run it where there IS network to Deriv (your machine or a normal shell) — the
managed web-session sandbox blocks ws.derivws.com, so it cannot run there.

    cd voltexai
    pip install -r requirements-mcp.txt          # provides 'websockets'
    export DERIV_API_TOKEN=<your DEMO api token>  # Deriv > Settings > API token
    # optional overrides:
    #   export DERIV_SMOKE_SYMBOL=R_75     (Deriv code: R_10/R_25/R_75/R_100/BOOM1000/CRASH1000/stpRNG/JD100)
    #   export DERIV_SMOKE_DIR=LONG        (LONG or SHORT)
    #   export DERIV_SMOKE_STAKE=1         (account currency)
    #   export DERIV_SMOKE_MULT=100        (multiplier; Deriv rejects invalid values and lists valid ones)
    python -m scripts.deriv_smoke

Exit code 0 = pass. Never trades a real account: it aborts if the token is not
a demo/virtual account.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services import deriv_exec  # noqa: E402


def main() -> int:
    token = os.getenv("DERIV_API_TOKEN", "").strip()
    if not token:
        print("✗ Set DERIV_API_TOKEN to a Deriv DEMO API token first.")
        return 2

    symbol = os.getenv("DERIV_SMOKE_SYMBOL", "R_75").strip()
    direction = os.getenv("DERIV_SMOKE_DIR", "LONG").strip().upper()
    stake = float(os.getenv("DERIV_SMOKE_STAKE", "1"))
    mult = int(os.getenv("DERIV_SMOKE_MULT", "100"))

    print(f"→ Deriv smoke test: {direction} {symbol} stake={stake} x{mult} (DEMO only)")

    # 1) authorize + demo assertion happen inside deriv_exec.execute (allow_real=False)
    fill = deriv_exec.execute(
        {"direction": direction}, deriv_symbol=symbol, stake=stake, multiplier=mult,
        stop_loss_amt=stake, take_profit_amt=round(stake * 2, 2),
        allow_real=False, token=token)

    if fill.get("error"):
        print("✗ Execution error:", fill["error"])
        # A multiplier/limit error here is useful signal: Deriv tells you valid values.
        return 1

    if not fill.get("is_virtual", False):
        print("✗ SAFETY: account is not virtual — aborting (should have been blocked).")
        return 1

    cid = fill["contract_id"]
    print(f"✓ Bought contract {cid} on {fill.get('account')} (virtual={fill['is_virtual']})")
    print(f"  buy_price={fill['buy_price']}  longcode={fill.get('longcode','')[:90]}")

    time.sleep(2)

    closed = deriv_exec.close_contract(cid, token=token)
    if closed.get("error"):
        print("⚠ Bought OK but close failed:", closed["error"])
        print("  Close it manually in Deriv (contract id above).")
        return 1
    print(f"✓ Closed contract {cid}: sold_for={closed.get('sold_for')}")
    print("PASS — the live Deriv execution path works end-to-end on your demo account.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
