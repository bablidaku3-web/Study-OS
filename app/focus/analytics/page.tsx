"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Clock3, Flame, PieChart, TrendingUp } from "lucide-react";
import { buildAnalytics, formatFocusTime } from "@/lib/data/focusAnalytics";
import { FocusSession, focusSessionRepository } from "@/lib/data/focusSessionRepository";
import { Chapter, chapterRepository } from "@/lib/data/chapterRepository";

const colors = ["#b9f36b", "#77b9ef", "#edc95d", "#d890ef", "#f18b76", "#70d6b3", "#fa9db4", "#a99cf4"];

function BarChart({ data, compact = false, onSelect }: { data: { label: string; key?: string; seconds: number }[]; compact?: boolean; onSelect?: (key: string) => void }) {
  const max = Math.max(1, ...data.map((item) => item.seconds));
  return <div className={`analytics-bars ${compact ? "compact" : ""}`}>{data.map((item) => <button className="analytics-bar-column" key={item.key || item.label} title={`${item.label}: ${formatFocusTime(item.seconds)}`} aria-label={`${item.label}: ${formatFocusTime(item.seconds)}`} onClick={() => onSelect?.(item.key || item.label)}><div className="analytics-bar-track"><div className="analytics-bar-fill" style={{ height: `${item.seconds ? Math.max(3, item.seconds / max * 100) : 0}%`, background: "#b9f36b" }} /></div><span>{item.label}</span></button>)}</div>;
}

function Distribution({ data, total, onSelect }: { data: { name: string; seconds: number }[]; total: number; onSelect?: (name: string) => void }) {
  if (!data.some((item) => item.seconds > 0)) return <div className="analytics-empty">Recorded focus data will appear here.</div>;
  return <div className="distribution-list">{data.map((item, index) => <button className="distribution-row" key={item.name} title={`${item.name}: ${formatFocusTime(item.seconds)}`} onClick={() => onSelect?.(item.name)}><span className="distribution-dot" style={{ background: colors[index % colors.length] }} /><span className="distribution-name">{item.name}</span><span className="distribution-track"><i style={{ width: `${total ? Math.min(100, item.seconds / total * 100) : 0}%`, background: colors[index % colors.length] }} /></span><span className="distribution-time">{formatFocusTime(item.seconds)}</span><b>{total ? Math.round(item.seconds / total * 100) : 0}%</b></button>)}</div>;
}

function SubjectPie({ data, total }: { data: { name: string; seconds: number; percent: number }[]; total: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  let cursor = 0;
  const slices = data.filter((item) => item.seconds > 0).map((item) => {
    const start = cursor; cursor += item.seconds / total * 100;
    return { ...item, start, end: cursor };
  });
  const gradient = slices.length ? `conic-gradient(${slices.map((slice, index) => `${colors[index % colors.length]} ${slice.start}% ${slice.end}%`).join(",")})` : "#202923";
  const active = slices.find((item) => item.name === selected) || null;
  return <div className="subject-pie-wrap"><button className="subject-pie" style={{ background: gradient }} aria-label="Subject study time pie chart; select a subject below" onClick={() => setSelected(null)}><span><b>{active ? formatFocusTime(active.seconds) : formatFocusTime(total)}</b><small>{active?.name || "TOTAL FOCUS"}</small></span></button><div className="pie-legend">{data.map((item, index) => <button key={item.name} className={selected === item.name ? "selected" : ""} onClick={() => setSelected(selected === item.name ? null : item.name)}><i style={{ background: colors[index % colors.length] }} /><span>{item.name}</span><b>{formatFocusTime(item.seconds)}</b><small>{item.percent}%</small></button>)}</div></div>;
}

function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Clock3 }) {
  return <article className="card analytics-stat"><div className="analytics-stat-head"><span>{label}</span><i><Icon size={14} /></i></div><strong>{value}</strong><small>{note}</small></article>;
}

export default function FocusAnalyticsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [range, setRange] = useState<"week" | "month">("week");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([focusSessionRepository.list(), chapterRepository.list()])
      .then(([loadedSessions, loadedChapters]) => { setSessions(loadedSessions); setChapters(loadedChapters); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to read saved study data."))
      .finally(() => setLoading(false));
  }, []);
  const analytics = useMemo(() => buildAnalytics(sessions, new Date(), chapters), [sessions, chapters]);
  const trend = range === "week" ? analytics.weekly : analytics.monthly;
  const trendTotal = range === "week" ? analytics.totals.week : analytics.totals.month;
  const hasData = analytics.totals.all > 0;
  const leastWithZeros = [...analytics.subjects].sort((a, b) => a.seconds - b.seconds)[0];
  const topTopics = analytics.topics.filter((item) => item.name !== "Unspecified topic");
  const subjectChapters = analytics.chapters.filter((item) => !selectedSubject || analytics.studyRecords.some((session) => session.subject === selectedSubject && (session.chapter || "Unspecified chapter") === item.name));
  const unusedChapters = analytics.neglectedChapters.filter((item) => !selectedSubject || item.subject === selectedSubject);

  return <main className="analytics-page"><header className="focus-topbar"><Link href="/focus" className="focus-back"><ArrowLeft size={15} /> Focus room</Link><div className="focus-brand"><span>श</span> SHUNYA <small>FOCUS ANALYTICS</small></div><Link href="/focus/history" className="focus-chapters-link"><Clock3 size={13} /> History</Link></header><div className="analytics-content">
    <div className="analytics-hero"><div><div className="focus-kicker"><Activity size={12} /> YOUR STUDY DATA · SAVED TIMER SESSIONS</div><h1>Focus, made visible.</h1><p>Understand where your study time goes, using recorded focus sessions only.</p></div><Link href="/focus/tools" className="analytics-action">Open timers <ArrowUpRight size={13} /></Link></div>
    {!loading && !hasData && <div className="analytics-empty-banner"><Clock3 size={16} /><div><strong>No focus data yet</strong><span>Complete or interrupt a focus session to start building your real analytics.</span></div></div>}
    <section className="analytics-stat-grid"><StatCard label="FOCUSED TODAY" value={formatFocusTime(analytics.totals.today)} note="Active focused seconds" icon={Clock3}/><StatCard label="THIS WEEK" value={formatFocusTime(analytics.totals.week)} note="Monday through today" icon={CalendarDays}/><StatCard label="THIS MONTH" value={formatFocusTime(analytics.totals.month)} note="Month to date" icon={TrendingUp}/><StatCard label="DAILY AVERAGE" value={formatFocusTime(analytics.totals.averageDay)} note="Per day with recorded focus" icon={Activity}/></section>
    <section className="analytics-stat-grid analytics-stat-grid-small"><StatCard label="COMPLETED SESSIONS" value={String(analytics.counts.completed)} note="Includes zero-focus break sessions" icon={BookOpen}/><StatCard label="INTERRUPTED" value={String(analytics.counts.interrupted)} note="All unique saved records" icon={Flame}/><StatCard label="COMPLETION RATE" value={hasData ? `${analytics.counts.completionRate}%` : "—"} note="Completed / all saved sessions" icon={PieChart}/></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>{range === "week" ? "Weekly productivity" : "Monthly study trend"}</h2><p>{formatFocusTime(trendTotal)} of focus in this {range}</p></div><div className="analytics-toggle"><button className={range === "week" ? "selected" : ""} onClick={() => setRange("week")}>Weekly</button><button className={range === "month" ? "selected" : ""} onClick={() => setRange("month")}>Monthly</button></div></div><BarChart data={trend} compact={range === "month"}/><div className="chart-caption">{analytics.weeklyChange === null ? "Weekly comparison appears after the previous week has focus records." : `This week ${analytics.weeklyChange >= 0 ? "up" : "down"} ${Math.abs(analytics.weeklyChange)}% from last week.`}</div></article>
      <article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Daily focus · this week</h2><p>Recorded active time by day</p></div><CalendarDays size={14}/></div><BarChart data={analytics.daily}/><div className="chart-caption">{analytics.productiveDay ? `Most productive: ${analytics.productiveDay.label} (${formatFocusTime(analytics.productiveDay.seconds)}).` : "No focus sessions recorded this week."}</div></article></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Subject study time</h2><p>Interactive share of total focus · click a label</p></div><PieChart size={14}/></div>{hasData ? <SubjectPie data={analytics.subjects} total={analytics.totals.all}/> : <div className="analytics-empty">Subject distribution appears after recorded focus.</div>}<div className="insight-pair"><span>Most studied<b>{analytics.mostStudiedSubject || "—"}</b></span><span>Least time recorded<b>{hasData ? leastWithZeros.name : "—"}</b></span></div></article>
      <article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Theory vs practice</h2><p>Actual activity labels on recorded sessions</p></div><Activity size={14}/></div><Distribution data={analytics.activities} total={analytics.totals.all} onSelect={(activity) => { window.location.href = `/focus/history?activity=${encodeURIComponent(activity)}`; }}/></article></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Chapter focus</h2><p>Compare saved focus time by chapter</p></div><BookOpen size={14}/></div><label className="analytics-filter">Subject filter<select value={selectedSubject} onChange={(event) => setSelectedSubject(event.target.value)}><option value="">All subjects</option>{["Physics","Chemistry","Mathematics","Biology"].map((name)=><option key={name}>{name}</option>)}</select></label><Distribution data={subjectChapters} total={analytics.totals.all} onSelect={(chapter) => setSelectedChapter(selectedChapter === chapter ? "" : chapter)}/>{selectedChapter && <p className="chart-caption">Selected chapter: {selectedChapter}</p>}</article><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Topic focus</h2><p>Recorded attention by topic</p></div><Flame size={14}/></div>{topTopics.length ? <><Distribution data={topTopics} total={analytics.totals.all}/><div className="insight-pair"><span>Most studied<b>{topTopics[0]?.name || "—"}</b></span><span>Least recorded<b>{topTopics[topTopics.length - 1]?.name || "—"}</b></span></div></> : <div className="analytics-empty">No topic names have been saved yet. Add a topic when starting a timer.</div>}</article></section>
    <section className="card insights-panel"><div className="analytics-panel-head"><div><h2>Smart insights</h2><p>Observations grounded in your saved sessions and syllabus</p></div><Activity size={14}/></div><div className="insight-grid">{analytics.mostStudiedSubject && <div><span>MOST STUDIED SUBJECT</span><strong>{analytics.mostStudiedSubject}</strong></div>}{hasData && <div><span>LEAST STUDY TIME · SUBJECT</span><strong>{leastWithZeros.name}</strong></div>}{analytics.productiveDay && <div><span>MOST PRODUCTIVE DAY THIS WEEK</span><strong>{analytics.productiveDay.label} · {formatFocusTime(analytics.productiveDay.seconds)}</strong></div>}<div><span>WEEK-OVER-WEEK FOCUS</span><strong>{analytics.weeklyChange === null ? "Need previous-week focus data" : `${analytics.weeklyChange >= 0 ? "+" : ""}${analytics.weeklyChange}%`}</strong></div><div><span>CHAPTERS WITHOUT RECORDED FOCUS</span><strong>{unusedChapters.length} in selected scope</strong></div></div>{unusedChapters.length > 0 && <div className="neglected-list">{unusedChapters.slice(0,6).map((chapter)=><span key={chapter.id}>{chapter.subject} · {chapter.name}</span>)}</div>}<p className="insight-disclaimer">“Neglected” here means no timer focus record for a chapter in the saved syllabus, not poor mastery. Low practice-performance comparison needs test-attempt data, not yet available.</p></section>
    {loading && <div className="analytics-loading">Loading saved focus data…</div>}{error && <div className="focus-error" role="alert">{error}</div>}<footer className="analytics-footer"><span>SHUNYA · REAL SESSION DATA ONLY</span><span>{analytics.records.length} unique sessions · {analytics.studyRecords.length} with focus time</span></footer>
  </div></main>;
}
