"""
VoltexAI MCP server — Phase 0-2.

A standalone Model Context Protocol server that exposes VoltexAI's trading tools
to an AI agent (Claude Desktop, an IDE, or the VoltexAI Terminal as an MCP
client):
  - Phase 0: market data (quotes, candles, symbol catalog);
  - Phase 1: read-only broker account (balance, positions) on a DEMO account;
  - Phase 2: PAPER order tools (place/close) behind a server-side risk layer.

No live-money path exists yet: the account layer is demo-only, orders hit a
paper book, and every order passes the risk layer first. Phase 3 (KYC-gated
live trading) builds on this same package. See README.md.
"""
