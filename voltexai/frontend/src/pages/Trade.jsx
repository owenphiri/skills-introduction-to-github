// src/pages/Trade.jsx — trade execution desk (account, ticket, positions, orders)
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { tradeService } from "../services/trade";
import { marketsService } from "../services/markets";
import { useAuth } from "../contexts/AuthContext";

const POPULAR = ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSD", "ETHUSD", "NAS100", "AAPL", "TSLA", "NVDA"];

export default function Trade() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [broker, setBroker] = useState(null);
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    symbol: (params.get("symbol") || "XAUUSD").toUpperCase(),
    side: params.get("side")?.toLowerCase() === "sell" ? "sell" : "buy",
    qty: 1, type: "market", limit_price: "",
  });

  const isFree = (user?.plan || "free") === "free";

  const refresh = useCallback(() => {
    tradeService.account().then(setAccount).catch(() => {});
    tradeService.positions().then((d) => setPositions(d.positions)).catch(() => {});
    tradeService.orders(20).then((d) => setOrders(d.orders)).catch(() => {});
  }, []);

  useEffect(() => { tradeService.broker().then(setBroker).catch(() => {}); }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    const load = () => marketsService.quote(form.symbol)
      .then((q) => alive && setQuote(q)).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [form.symbol]);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const payload = {
        symbol: form.symbol, side: form.side, qty: Number(form.qty), type: form.type,
        ...(form.type === "limit" ? { limit_price: Number(form.limit_price) } : {}),
      };
      const o = await tradeService.placeOrder(payload);
      setMsg(o.status === "filled"
        ? `${form.side.toUpperCase()} ${form.qty} ${form.symbol} filled @ ${o.filled_price}`
        : `Limit order placed (${o.status}).`);
      refresh();
    } catch (e2) {
      setErr(e2.message || "Order failed");
    } finally {
      setBusy(false);
    }
  }

  async function closePosition(p) {
    setErr(""); setMsg("");
    try {
      await tradeService.placeOrder({
        symbol: p.symbol, side: p.qty > 0 ? "sell" : "buy",
        qty: Math.abs(p.qty), type: "market",
      });
      setMsg(`Closed ${p.symbol}`);
      refresh();
    } catch (e2) { setErr(e2.message || "Close failed"); }
  }

  async function cancel(id) {
    try { await tradeService.cancelOrder(id); refresh(); }
    catch (e2) { setErr(e2.message); }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>Trade Desk</h1>
          {broker && (
            <span className={`vx-broker-badge ${broker.is_live ? "live" : "paper"}`}>
              {broker.is_live ? "● LIVE BROKER" : "● PAPER TRADING"} · {broker.broker}
            </span>
          )}
          <p className="vx-muted">{broker?.note || "Loading broker…"}</p>
        </div>

        {account && (
          <div className="vx-stat-row">
            <div className="vx-stat"><b>${account.equity.toLocaleString()}</b><span>Equity</span></div>
            <div className="vx-stat"><b>${account.cash.toLocaleString()}</b><span>Cash</span></div>
            <div className="vx-stat">
              <b className={account.unrealized_pnl >= 0 ? "vx-up" : "vx-down"}>
                {account.unrealized_pnl >= 0 ? "+" : ""}${account.unrealized_pnl.toLocaleString()}
              </b><span>Unrealized P&L</span>
            </div>
            <div className="vx-stat">
              <b className={account.realized_pnl >= 0 ? "vx-up" : "vx-down"}>
                {account.realized_pnl >= 0 ? "+" : ""}${account.realized_pnl.toLocaleString()}
              </b><span>Realized P&L</span>
            </div>
            <div className="vx-stat">
              <b className={account.total_return_pct >= 0 ? "vx-up" : "vx-down"}>
                {account.total_return_pct >= 0 ? "+" : ""}{account.total_return_pct}%
              </b><span>Return</span>
            </div>
          </div>
        )}

        <div className="vx-trade-grid">
          <form className="vx-ticket" onSubmit={submit}>
            <h3>Order ticket</h3>
            <div className="vx-side-toggle">
              <button type="button" className={form.side === "buy" ? "buy active" : "buy"}
                onClick={() => setForm({ ...form, side: "buy" })}>Buy / Long</button>
              <button type="button" className={form.side === "sell" ? "sell active" : "sell"}
                onClick={() => setForm({ ...form, side: "sell" })}>Sell / Short</button>
            </div>

            <label className="vx-field">Symbol
              <input list="vx-symbols" value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
              <datalist id="vx-symbols">
                {POPULAR.map((s) => <option key={s} value={s} />)}
              </datalist>
            </label>

            {quote && (
              <div className="vx-ticket-quote">
                <span>Bid <b className="vx-down">{quote.bid}</b></span>
                <span className="vx-mono">{quote.price}</span>
                <span>Ask <b className="vx-up">{quote.ask}</b></span>
              </div>
            )}

            <label className="vx-field">Quantity
              <input type="number" min="0" step="any" value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            </label>

            <div className="vx-tf-toggle vx-order-type">
              {["market", "limit"].map((t) => (
                <button type="button" key={t} className={form.type === t ? "active" : ""}
                  onClick={() => setForm({ ...form, type: t })}>{t}</button>
              ))}
            </div>

            {form.type === "limit" && (
              <label className="vx-field">Limit price
                <input type="number" min="0" step="any" value={form.limit_price}
                  onChange={(e) => setForm({ ...form, limit_price: e.target.value })} />
              </label>
            )}

            {quote && (
              <p className="vx-ticket-notional">
                Est. notional ≈ <b>${(Number(form.qty) * quote.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
              </p>
            )}

            {isFree ? (
              <Link to="/pricing?reason=upgrade" className="vx-btn-primary vx-btn-block">
                Upgrade to trade
              </Link>
            ) : (
              <button type="submit" disabled={busy}
                className={`vx-btn-block ${form.side === "buy" ? "vx-btn-buy" : "vx-btn-sell"}`}>
                {busy ? "Placing…" : `${form.side === "buy" ? "Buy" : "Sell"} ${form.symbol}`}
              </button>
            )}
            {err && <p className="vx-banner vx-banner--warn">{err}</p>}
            {msg && <p className="vx-banner vx-banner--success">{msg}</p>}
          </form>

          <div className="vx-trade-tables">
            <div className="vx-table-wrap">
              <div className="vx-table-title">Open positions</div>
              <table className="vx-table">
                <thead><tr>
                  <th>Symbol</th><th>Side</th><th className="vx-r">Qty</th>
                  <th className="vx-r">Avg</th><th className="vx-r">Last</th>
                  <th className="vx-r">P&L</th><th></th>
                </tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td><b>{p.symbol}</b></td>
                      <td><span className={`vx-pill vx-pill--${p.side === "long" ? "long" : "short"}`}>{p.side}</span></td>
                      <td className="vx-r vx-mono">{p.qty}</td>
                      <td className="vx-r vx-mono">{p.avg_price}</td>
                      <td className="vx-r vx-mono">{p.current_price}</td>
                      <td className={`vx-r vx-mono ${p.unrealized_pnl >= 0 ? "vx-up" : "vx-down"}`}>
                        {p.unrealized_pnl >= 0 ? "+" : ""}{p.unrealized_pnl} ({p.unrealized_pct}%)
                      </td>
                      <td className="vx-r">
                        {!isFree && <button className="vx-btn-mini" onClick={() => closePosition(p)}>Close</button>}
                      </td>
                    </tr>
                  ))}
                  {positions.length === 0 && (
                    <tr><td colSpan="7" className="vx-center vx-muted">No open positions</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="vx-table-wrap">
              <div className="vx-table-title">Recent orders</div>
              <table className="vx-table">
                <thead><tr>
                  <th>Symbol</th><th>Side</th><th className="vx-r">Qty</th>
                  <th>Type</th><th className="vx-r">Fill</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><b>{o.symbol}</b></td>
                      <td className={o.side === "buy" ? "vx-up" : "vx-down"}>{o.side}</td>
                      <td className="vx-r vx-mono">{o.qty}</td>
                      <td>{o.type}</td>
                      <td className="vx-r vx-mono">{o.filled_price ?? "—"}</td>
                      <td><span className={`vx-status vx-status--${o.status}`}>{o.status}</span></td>
                      <td className="vx-r">
                        {o.status === "pending" && !isFree &&
                          <button className="vx-btn-mini" onClick={() => cancel(o.id)}>Cancel</button>}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan="7" className="vx-center vx-muted">No orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="vx-fineprint">
          {broker?.is_live
            ? "LIVE mode: orders are routed to a real brokerage and move real money."
            : "Paper-trading mode: orders are simulated against live/model prices — no real money moves."}
          {" "}Educational tooling, not investment advice.
        </p>
      </main>
    </div>
  );
}
