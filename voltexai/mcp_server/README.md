# VoltexAI MCP Server — Phase 0–1 (market data + read-only account)

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
VoltexAI's market data and a **read-only** broker account as tools an AI agent
can call (Claude Desktop, an IDE, or the VoltexAI Terminal acting as an MCP
client). Market data reuses the app's own `market_service`, so the agent and the
platform always see the same prices.

**Still READ-ONLY.** Phase 0 = quotes, candles, symbol catalog. Phase 1 adds
account balance and open positions on a **demo** broker account (Deriv). Nothing
here can place, modify, or close a trade — order tools arrive in later phases
behind the risk layer (see *Roadmap*).

## Tools

### Phase 0 — market data
| Tool | Purpose |
|------|---------|
| `list_symbols(asset_class="all")` | Symbol catalog; filter by forex/metals/energy/indices/crypto/stocks |
| `get_quote(symbol)` | Latest quote for one symbol |
| `get_quotes(symbols)` | Latest quotes for up to 25 symbols |
| `get_candles(symbol, timeframe="M15", count=200)` | OHLC candles (TF: M1–D1, up to 500) |

### Phase 1 — read-only broker account (demo)
| Tool | Purpose |
|------|---------|
| `get_account()` | Balance, currency, demo flag for the connected account |
| `list_positions()` | Open positions on the connected account |
| `get_account_summary()` | Account balance + roll-up of open positions in one call |

**Broker adapter.** Account tools go through a pluggable adapter (`adapters/`);
the tools never name a broker. Phase 1 ships the **Deriv** adapter (WebSocket
API). MetaApi (MT5), OANDA and cTrader adapters slot into the same interface
later. It is **demo-only**: `get_account` refuses a live account unless
`MCP_ALLOW_LIVE=true` is set.

Configure it with environment variables (read by the server, never returned to
the model):

```bash
export DERIV_API_TOKEN=...     # a DEMO API token: Deriv > Account settings > API token
export DERIV_APP_ID=1089       # optional; 1089 is Deriv's public demo app id
# export MCP_BROKER=deriv      # optional; deriv is the default
```

## Install & run

```bash
cd voltexai
pip install -r backend/requirements.txt      # app deps (market_service)
pip install -r requirements-mcp.txt           # the MCP SDK
python -m mcp_server.server                    # runs over stdio
```

Live prices flow when a market provider is configured (`MARKET_DATA_PROVIDER`,
`TWELVEDATA_API_KEY`, …); otherwise the high-fidelity synthetic feed is used, so
the server always works offline.

## Connect Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "voltexai-markets": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/absolute/path/to/voltexai"
    }
  }
}
```

Restart Claude Desktop; the tools appear under the 🔌 menu. Try:
*"Using voltexai-markets, get me a quote for XAUUSD and the last 50 M15 candles."*
With a demo token set: *"…and show my account balance and open positions."*

## Design notes

- **Thin binding.** Tool logic lives in `tools.py` (market data) and
  `account_tools.py` (account) — pure, JSON-able, and it never raises for the
  caller (returns `{"error": …}`), so both are unit-testable without the MCP
  runtime or a network. `server.py` is just the FastMCP wrapper.
- **Pluggable brokers.** Account tools depend only on the `AccountAdapter`
  interface in `adapters/base.py`; `adapters/deriv.py` is the first
  implementation and `adapters/__init__.py` selects one from config.
- **Read-only & safe.** No writes, no orders. The account layer is demo-only and
  refuses a live account unless `MCP_ALLOW_LIVE` is set. Broker credentials are
  read from the environment by the adapter and never returned to the model.

## Roadmap (from the architecture sketch)

- **Phase 0:** read-only market data. ✅
- **Phase 1 — this package:** read account & positions on a **demo** account via
  the Deriv adapter. ✅
- **Phase 2:** paper-trade order tools behind the server-side **risk layer**
  (max lot, max daily loss, prop-firm rules, symbol allowlist, kill switch).
- **Phase 3:** live trading — KYC-gated, human-in-the-loop for size, audited.

Each phase adds adapters/tools to this same server; credentials always live in a
secrets vault and are injected by the server — never placed in the model context.
