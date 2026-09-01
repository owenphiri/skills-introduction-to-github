"""
VoltexAI MCP server — Phase 0-1 (read-only).

A standalone Model Context Protocol server that exposes VoltexAI's market data
(quotes, candles, symbol catalog) and a read-only broker account (balance and
open positions on a DEMO account, via a pluggable adapter) as tools an AI agent
can call — Claude Desktop, an IDE, or the VoltexAI Terminal acting as an MCP
client.

Still READ-ONLY: no order placement. The account layer is demo-only. Gated
order tools behind the risk layer (Phase 2+) build on this same package.
See README.md.
"""
