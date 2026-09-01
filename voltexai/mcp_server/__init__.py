"""
VoltexAI MCP server — Phase 0 (read-only market data).

A standalone Model Context Protocol server that exposes VoltexAI's market data
(quotes, candles, symbol catalog) as tools an AI agent can call — Claude Desktop,
an IDE, or the VoltexAI Terminal acting as an MCP client.

Phase 0 is deliberately READ-ONLY: no account access and no order placement.
Account/positions (Phase 1) and gated order tools behind the risk layer
(Phase 2+) build on this same package. See README.md.
"""
