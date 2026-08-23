// src/pages/Competition.jsx — Voltex Competition (contests + leaderboard + gamification)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { Footer } from "../components/Footer";
import { competitionService, ecosystemService } from "../services/ecosystem";
import { useAuth } from "../contexts/AuthContext";

function Medal({ rank }) {
  const m = { 1: "🥇", 2: "🥈", 3: "🥉" }[rank];
  return <span className="vx-medal">{m || `#${rank}`}</span>;
}

export default function Competition() {
  const { user } = useAuth();
  const [contests, setContests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [board, setBoard] = useState(null);
  const [game, setGame] = useState(null);
  const [msg, setMsg] = useState("");

  const loadContests = () =>
    competitionService.list().then((d) => {
      setContests(d.contests);
      if (!selected && d.contests[0]) setSelected(d.contests[0].id);
    }).catch(() => {});

  useEffect(() => { loadContests(); }, []);
  useEffect(() => { if (user) ecosystemService.gamification().then(setGame).catch(() => {}); }, [user]);
  useEffect(() => {
    if (!selected) return;
    const load = () => competitionService.leaderboard(selected).then(setBoard).catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [selected]);

  async function join(id) {
    setMsg("");
    try {
      const r = await competitionService.join(id);
      setMsg(r.message);
      loadContests();
    } catch (e) {
      setMsg(e.status === 401 ? "Log in to enter the contest." : e.message);
    }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🏆 Voltex Competition</h1>
          <p className="vx-muted">
            Weekly & monthly trading contests on simulated accounts with verified brokers.
            Trade your paper account, climb the live leaderboard, win real prizes.
          </p>
        </div>

        {game && (
          <div className="vx-game-bar vx-rise">
            <div className="vx-game-rank">
              <span className="vx-game-level">LVL {game.level}</span>
              <b>{game.rank}</b>
            </div>
            <div className="vx-game-xp">
              <div className="vx-xp-track"><div className="vx-xp-fill" style={{ width: `${game.progress_pct}%` }} /></div>
              <small>{game.xp_into_level} / {game.xp_for_next} XP to next level · {game.xp} total XP</small>
            </div>
            <div className="vx-game-badges">
              {game.badges.filter((b) => b.earned).slice(0, 5).map((b) => (
                <span key={b.id} className="vx-badge" title={`${b.name}: ${b.desc}`}>{b.icon}</span>
              ))}
              {game.badges.filter((b) => b.earned).length === 0 &&
                <span className="vx-muted" style={{ fontSize: 12 }}>Trade to earn badges →</span>}
            </div>
          </div>
        )}

        <div className="vx-card-grid">
          {contests.map((c) => (
            <div key={c.id} className={`vx-contest-card vx-rise ${selected === c.id ? "active" : ""}`}
              onClick={() => setSelected(c.id)}>
              <div className="vx-contest-top">
                <span className="vx-contest-cadence">{c.cadence}</span>
                <span className="vx-contest-prize">${c.prize_usd.toLocaleString()}</span>
              </div>
              <h3>{c.name}</h3>
              <p className="vx-muted">{c.desc}</p>
              <div className="vx-contest-meta">
                <span>👥 {c.entrants} entrants</span>
                <span>💵 ${(c.starting_balance / 1000)}K start</span>
                <span>🎟️ {c.entry}</span>
              </div>
              {c.joined ? (
                <button className="vx-btn-current" disabled>✓ Entered</button>
              ) : (
                <button className="vx-btn-primary vx-btn-sm" onClick={(e) => { e.stopPropagation(); join(c.id); }}>
                  Enter contest
                </button>
              )}
            </div>
          ))}
        </div>
        {msg && <div className="vx-banner vx-banner--info">{msg}</div>}

        {board && (
          <>
            <h2 className="vx-section-title vx-left">
              {board.contest.name} · Leaderboard <span className="vx-live-dot">LIVE</span>
            </h2>
            <div className="vx-table-wrap">
              <table className="vx-table">
                <thead><tr><th>Rank</th><th>Trader</th><th>Country</th>
                  <th className="vx-r">Return</th><th className="vx-r">P&L</th></tr></thead>
                <tbody>
                  {board.leaderboard.map((r) => (
                    <tr key={r.rank} className={r.rank <= 3 ? "vx-podium" : ""}>
                      <td><Medal rank={r.rank} /></td>
                      <td><b>{r.name}</b></td>
                      <td className="vx-muted">{r.country || "—"}</td>
                      <td className={`vx-r vx-mono ${r.return_pct >= 0 ? "vx-up" : "vx-down"}`}>
                        {r.return_pct >= 0 ? "+" : ""}{r.return_pct}%
                      </td>
                      <td className={`vx-r vx-mono ${r.pnl >= 0 ? "vx-up" : "vx-down"}`}>
                        {r.pnl >= 0 ? "+" : ""}{r.pnl}
                      </td>
                    </tr>
                  ))}
                  {board.leaderboard.length === 0 && (
                    <tr><td colSpan="5" className="vx-center vx-muted">
                      No entrants yet — be the first on the board!
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="vx-fineprint">
          Contests run on simulated accounts. Prizes and verified-broker terms are
          announced per event. Not investment advice.
        </p>
      </main>
      <Footer />
    </div>
  );
}
