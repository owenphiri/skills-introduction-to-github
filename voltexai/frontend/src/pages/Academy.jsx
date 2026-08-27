// src/pages/Academy.jsx — Voltex Academy (trading education)
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { useI18n } from "../i18n";
import { Footer } from "../components/Footer";
import { academyService } from "../services/ecosystem";

export default function Academy() {
  const { t } = useI18n();
  const [overview, setOverview] = useState(null);
  const [track, setTrack] = useState("all");
  const [courses, setCourses] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => { academyService.overview().then(setOverview).catch(() => {}); }, []);
  useEffect(() => {
    academyService.courses(track).then((d) => setCourses(d.courses)).catch(() => {});
  }, [track]);

  return (
    <div className="vx-page">
      <NavBar />
      <main className="vx-container">
        <div className="vx-page-head">
          <h1>🎓 Voltex Academy</h1>
          <p className="vx-muted">{t("pg.academy.sub")}</p>
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
                {c.lessons.slice(0, open === c.id ? c.lessons.length : 3).map((l, i) => (
                  <li key={i}><span className="vx-lesson-num">{i + 1}</span>{l}</li>
                ))}
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
      <Footer />
    </div>
  );
}
