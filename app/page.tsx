"use client";

import { useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, CircleHelp, Clock3, Command, Flame, FlaskConical,
  GraduationCap, LayoutDashboard, Menu, Moon, MoreHorizontal, Play, Search,
  Settings2, Sparkles, Sun, Target, Timer, TrendingUp, Users, X
} from "lucide-react";

type IconComponent = typeof LayoutDashboard;

const navigation: { label: string; icon: IconComponent; group: string }[] = [
  { label: "Overview", icon: LayoutDashboard, group: "STUDY SPACE" },
  { label: "Day planner", icon: CalendarDays, group: "STUDY SPACE" },
  { label: "Chapter zones", icon: Activity, group: "STUDY SPACE" },
  { label: "Focus room", icon: Timer, group: "STUDY SPACE" },
  { label: "Tests & mocks", icon: FlaskConical, group: "PREPARATION" },
  { label: "Mistake vault", icon: CircleHelp, group: "PREPARATION" },
  { label: "Revision", icon: BookOpen, group: "PREPARATION" },
  { label: "AI doubt solver", icon: Sparkles, group: "TOOLS" }
];

const stats = [
  { label: "Focused today", value: "2h 40m", note: "of 6h daily goal", icon: Clock3, trend: "12%" },
  { label: "Study streak", value: "12 days", note: "Your best is 18 days", icon: Flame, trend: "4 days" },
  { label: "Syllabus covered", value: "38%", note: "Across all subjects", icon: BookOpen, trend: "+3.2%" },
  { label: "Average accuracy", value: "76.4%", note: "Across 8 practice tests", icon: Target, trend: "+5.8%" }
];

function TrendChart() {
  return (
    <div className="chart-wrap" aria-label="Weekly focus hours chart">
      <svg viewBox="0 0 620 170" role="img" aria-labelledby="chart-title">
        <title id="chart-title">Focus hours across the week</title>
        <defs>
          <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b9f36b" stopOpacity=".2" />
            <stop offset="100%" stopColor="#b9f36b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 62, 100, 138].map((y) => <line key={y} x1="38" y1={y} x2="605" y2={y} className="chart-gridline" />)}
        {["6h", "4h", "2h", "0h"].map((label, index) => <text key={label} x="0" y={27 + index * 38} className="chart-label">{label}</text>)}
        <path d="M38 104 C65 98 82 106 120 84 S175 99 205 68 S262 80 290 58 S340 67 375 73 S430 47 460 55 S512 31 545 47 S580 35 605 28 L605 138 L38 138 Z" fill="url(#areaFill)" />
        <path d="M38 104 C65 98 82 106 120 84 S175 99 205 68 S262 80 290 58 S340 67 375 73 S430 47 460 55 S512 31 545 47 S580 35 605 28" fill="none" stroke="#b9f36b" strokeWidth="2.5" strokeLinecap="round" />
        {[38,120,205,290,375,460,545,605].map((x, i) => <circle key={x} cx={x} cy={[104,84,68,58,73,55,47,28][i]} r="3" fill="#b9f36b" stroke="#101612" strokeWidth="2" />)}
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => <text key={d} x={65 + i * 82} y="160" textAnchor="middle" className="chart-label">{d}</text>)}
      </svg>
    </div>
  );
}

function FocusRing() {
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label="44 percent of today's focus goal">
      <circle cx="50" cy="50" r="41" fill="none" stroke="#26312a" strokeWidth="7" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#b9f36b" strokeWidth="7" strokeLinecap="round" strokeDasharray="113 258" transform="rotate(-90 50 50)" />
      <text x="50" y="48" textAnchor="middle" fill="#f2f5f1" fontSize="18" fontWeight="600">44%</text>
      <text x="50" y="62" textAnchor="middle" fill="#829087" fontSize="7">DAILY GOAL</text>
    </svg>
  );
}

export default function Dashboard() {
  const [active, setActive] = useState("Overview");
  const [lightMode, setLightMode] = useState(false);
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function Sidebar() {
    return (
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">श</div><div>SHUNYA<small>AI STUDYOS</small></div></div>
        {(["STUDY SPACE", "PREPARATION", "TOOLS"] as const).map((group) => (
          <div key={group}>
            <div className="nav-label">{group}</div>
            <nav className="nav-list" aria-label={group.toLowerCase()}>
              {navigation.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => { setActive(label); if (label !== "Overview") notify(`${label} is coming in the next build phase.`); setMobileOpen(false); }}>
                  <Icon size={15} strokeWidth={1.8} />{label}{label === "Mistake vault" && <span className="nav-trail">03</span>}
                </button>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="study-card"><p><GraduationCap size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} /> YOUR TARGET</p><strong>JEE Advanced · 2027</strong><div className="progress-track"><div className="progress-fill" /></div></div>
          <button className="nav-item" onClick={() => notify("Settings will be available in a later phase.")}><Settings2 size={15} />Settings</button>
          <div className="profile"><div className="avatar">AK</div><div><strong>Arjun Kumar</strong><span>Class 12 · Aspirant</span></div><MoreHorizontal size={16} style={{ marginLeft: "auto", color: "#7b887e" }} /></div>
        </div>
      </aside>
    );
  }

  return (
    <div className={`shell ${lightMode ? "light" : ""}`}>
      <Sidebar />
      {mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position: "fixed", inset: 0, background: "#0009", zIndex: 5 }}><div onClick={(event) => event.stopPropagation()} style={{ width: 248, height: "100%", background: "#0c110e" }}><button aria-label="Close menu" className="nav-item" onClick={() => setMobileOpen(false)}><X size={15} />Close menu</button><Sidebar /></div></div>}
      <main className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={16} /></button>
            <div className="crumb">Study space <span style={{ padding: "0 7px", color: "#4d5a50" }}>/</span><b>{active}</b></div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Search" onClick={() => notify("Search will be available with your study data.")}><Search size={15} /></button>
            <button className="icon-button" aria-label="Toggle color theme" onClick={() => setLightMode(!lightMode)}>{lightMode ? <Moon size={15} /> : <Sun size={15} />}</button>
            <button className="icon-button" aria-label="Notifications" onClick={() => notify("You're all caught up — no new notifications.")}><Bell size={15} /><span className="notification-dot" /></button>
          </div>
        </header>
        <div className="page-heading">
          <div><div className="eyebrow">MONDAY, NOVEMBER 9, 2026 <span style={{ color: "#b9f36b", marginLeft: 7 }}>· WEEK 46</span></div><h1>Good morning, Arjun <span aria-hidden="true">✳</span></h1><p className="subtitle">Small steps every day. You're building something meaningful.</p></div>
          <div className="date-pill"><CalendarDays size={13} /> Monday, Nov 9, 2026 <ChevronDown size={12} /></div>
        </div>
        <div className="demo-banner"><Sparkles size={13} /><span><strong>Preview dashboard</strong> — example data shown here. Your personal analytics will appear once you set up your profile.</span></div>
        <section className="stats-grid" aria-label="Study statistics">
          {stats.map(({ label, value, note, icon: Icon, trend }) => <article className="card stat-card" key={label}>
            <div className="stat-top"><span>{label}</span><div className="stat-icon"><Icon size={14} /></div></div>
            <div className="stat-value">{value}</div><div className="stat-note"><b>{trend}</b> {note}</div>
          </article>)}
        </section>
        <section className="content-grid">
          <article className="card">
            <div className="card-heading"><div><h2>Focus hours</h2><p>A steady rhythm beats a sprint</p></div><div className="chart-legend"><span className="legend-dot" /> This week <ChevronDown size={11} /></div></div>
            <TrendChart />
          </article>
          <article className="card zone-card">
            <div className="card-heading"><div><h2>Chapter zones</h2><p>Know where to focus next</p></div><button className="view-link" onClick={() => { setActive("Chapter zones"); notify("Chapter zones will be available in Phase 3."); }}>View all <ArrowUpRight size={11} style={{ verticalAlign: "-2px" }} /></button></div>
            <div className="zone-list">
              <div className="zone-row"><span className="zone-dot green" /><div className="zone-name"><strong>Electrostatics</strong><span>Physics · 84% accuracy</span></div><span className="zone-count">Strong</span></div>
              <div className="zone-row"><span className="zone-dot yellow" /><div className="zone-name"><strong>Chemical Bonding</strong><span>Chemistry · 62% accuracy</span></div><span className="zone-count">Review</span></div>
              <div className="zone-row"><span className="zone-dot red" /><div className="zone-name"><strong>Integration</strong><span>Mathematics · 41% accuracy</span></div><span className="zone-count">Priority</span></div>
              <div className="zone-row"><span className="zone-dot green" /><div className="zone-name"><strong>Current Electricity</strong><span>Physics · 79% accuracy</span></div><span className="zone-count">Strong</span></div>
            </div>
          </article>
        </section>
        <section className="bottom-grid">
          <article className="card agenda-card">
            <div className="card-heading"><div><h2>Today's plan</h2><p>A flexible outline for your day</p></div><button className="view-link" onClick={() => { setActive("Day planner"); notify("The editable planner will be built in Phase 2."); }}>Open planner <ArrowUpRight size={11} style={{ verticalAlign: "-2px" }} /></button></div>
            <div className="agenda-list">
              <div className="agenda-item"><span className="agenda-time">09:00</span><span className="agenda-line active" /><div className="agenda-info"><strong>Electrostatics · Practice set</strong><span>Physics · 45 min</span></div><span className="agenda-status"><Check size={12} style={{ verticalAlign: "-2px" }} /> Done</span></div>
              <div className="agenda-item"><span className="agenda-time">11:00</span><span className="agenda-line" /><div className="agenda-info"><strong>Chemical Bonding · NCERT review</strong><span>Chemistry · 60 min</span></div><span style={{ color: "#859187", fontSize: 9 }}>Next</span></div>
              <div className="agenda-item"><span className="agenda-time">14:30</span><span className="agenda-line" /><div className="agenda-info"><strong>Integration · PYQ practice</strong><span>Mathematics · 50 min</span></div><span style={{ color: "#859187", fontSize: 9 }}>Planned</span></div>
            </div>
          </article>
          <article className="card focus-card">
            <div className="card-heading"><div><h2>Today's focus</h2><p>Progress, not perfection</p></div><button className="icon-button" aria-label="More focus options" onClick={() => notify("Focus options are part of the timer phase.")} style={{ width: 27, height: 27, border: 0, background: "transparent" }}><MoreHorizontal size={15} /></button></div>
            <div className="focus-content"><FocusRing /><div className="focus-copy"><strong>2h 40m <span style={{ color: "#708075", fontSize: 10, fontWeight: 400 }}> / 6h</span></strong><span>You're right on track.<br />Keep your momentum going.</span><button className="focus-cta" onClick={() => notify("Focus timer is coming in Phase 4.")}><Play size={11} fill="currentColor" /> Start a focus session</button></div></div>
          </article>
        </section>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, color: "#637067", fontSize: 9 }}><span>SHUNYA AI STUDYOS · BUILDING YOUR BEST ROUTINE</span><span>Made for the long game <span style={{ color: "#b9f36b" }}>✳</span></span></div>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
