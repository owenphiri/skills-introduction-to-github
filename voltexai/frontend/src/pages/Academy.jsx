// src/pages/Academy.jsx — Voltex Academy (trading education)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { useI18n } from "../i18n";
import { Footer } from "../components/Footer";
import { academyService } from "../services/ecosystem";
import { useAuth } from "../contexts/AuthContext";

export default function Academy() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [track, setTrack] = useState("all");
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(null);
  const [done, setDone] = useState({});     // { "courseId:idx": true }
  const [toast, setToast] = useState("");

  useEffect(() => { academyService.overview().then(setOverview).catch(() => {}); }, []);
  useEffect(() => {
    academyService.courses(track).then((d) => setCourses(d.courses)).catch(() => {});
  }, [track]);

  async function complete(courseId, idx) {
    const key = `${courseId}:${idx}`;
    try {
      const r = await academyService.completeLesson(courseId, idx);
      setDone((d) => ({ ...d, [key]: true }));
      setToast(r.already_claimed ? "Lesson already completed ✓" : `+${r.earned} VXC earned! 🪙`);
      setTimeout(() => setToast(""), 2600);
    } catch {
      setToast("Could not save — try again.");
      setTimeout(() => setToast(""), 2600);
    }
  }

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🎓 Voltex Academy</h1>
          <p className="vx-muted">{t("pg.academy.sub")}</p>
          {user && <p className="vx-muted">Complete lessons to earn <b>🪙 40 VXC</b> each.</p>}
          {overview && (
            <div className="vx-stat-row" style={{ marginTop: 16 }}>
              <div className="vx-stat"><b className="vx-count">{overview.tracks.length}</b><span>Tracks</span></div>
              <div className="vx-stat"><b className="vx-count">{overview.total_courses}</b><span>Courses</span></div>
              <div className="vx-stat"><b className="vx-count">{overview.total_lessons}</b><span>Lessons</span></div>
              <div className="vx-stat"><b className="vx-count">∞</b><span>AI tutor</span></div>
            </div>
          )}
        </div>

        <div className="vx-class-tabs">
          <button className={track === "all" ? "active" : ""} onClick={() => setTrack("all")}>All</button>
          {overview?.tracks.map((t) => (
            <button key={t.id} className={track === t.id ? "active" : ""} onClick={() => setTrack(t.id)}>
              {t.icon} {t.name}
            </button>
          ))}
        </div>

        <div className="vx-card-grid">
          {courses.map((c) => (
            <div key={c.id} className="vx-course-card vx-rise">
              <div className="vx-course-top">
                <span className={`vx-level vx-level--${c.level.toLowerCase()}`}>{c.level}</span>
                <span className="vx-muted">{c.duration_min} min</span>
              </div>
              <h3>{c.title}</h3>
              <ul className="vx-course-lessons">
                {c.lessons.slice(0, open === c.id ? c.lessons.length : 3).map((l, i) => {
                  const isDone = done[`${c.id}:${i}`];
                  return (
                    <li key={i}>
                      <span className="vx-lesson-num">{i + 1}</span>
                      <span style={{ flex: 1 }}>{l}</span>
                      {user && (
                        isDone
                          ? <span className="vx-lesson-done">✓ +40 VXC</span>
                          : <button className="vx-lesson-claim" onClick={() => complete(c.id, i)}>
                              Mark done +40
                            </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {c.lessons.length > 3 && (
                <button className="vx-inline-link" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  {open === c.id ? "Show less" : `+${c.lessons.length - 3} more lessons`}
                </button>
              )}
              <Link to="/terminal" className="vx-btn-secondary vx-btn-sm" style={{ marginTop: 12 }}>
                Learn with the AI tutor →
              </Link>
            </div>
          ))}
        </div>
        <p className="vx-fineprint">
          Educational content by Owens Forex Academy. Not investment advice.
        </p>
      </main>
      {toast && <div className="vx-coin-toast">{toast}</div>}
      <Footer />
    </div>
  );
}
