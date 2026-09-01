# VoltexAI MCP Server — Phase 0 (read-only market data)

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes
VoltexAI's market data as tools an AI agent can call (Claude Desktop, an IDE, or
the VoltexAI Terminal acting as an MCP client). It reuses the app's own
`market_service`, so the agent and the platform always see the same prices.

**Phase 0 is READ-ONLY** — quotes, candles and the symbol catalog. No account
access, no order placement. Account/positions and gated order tools arrive in
later phases behind the risk layer (see *Roadmap*).

## Tools

| Tool | Purpose |
|------|---------|
| `list_symbols(asset_class="all")` | Symbol catalog; filter by forex/metals/energy/indices/crypto/stocks |
| `get_quote(symbol)` | Latest quote for one symbol |
| `get_quotes(symbols)` | Latest quotes for up to 25 symbols |
| `get_candles(symbol, timeframe="M15", count=200)` | OHLC candles (TF: M1–D1, up to 500) |

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

Restart Claude Desktop; the four tools appear under the 🔌 menu. Try:
*"Using voltexai-markets, get me a quote for XAUUSD and the last 50 M15 candles."*

## Design notes

- **Thin binding.** All logic lives in `tools.py` (pure, JSON-able, never raises
  on bad input — returns `{"error": …}`), so it is unit-testable without the MCP
  runtime. `server.py` is just the FastMCP wrapper.
- **Read-only & safe.** No credentials, no accounts, no writes. Nothing here can
  move money or place a trade.

## Roadmap (from the architecture sketch)

- **Phase 0 — this package:** read-only market data. ✅
- **Phase 1:** read account & positions on **demo** accounts via one adapter
  (Deriv or MetaApi for MT5).
- **Phase 2:** paper-trade order tools behind the server-side **risk layer**
  (max lot, max daily loss, prop-firm rules, symbol allowlist, kill switch).
- **Phase 3:** live trading — KYC-gated, human-in-the-loop for size, audited.

Each phase adds adapters/tools to this same server; credentials always live in a
secrets vault and are injected by the server — never placed in the model context.
