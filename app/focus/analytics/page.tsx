"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Clock3, Flame, PieChart, TrendingUp } from "lucide-react";
import { buildAnalytics, formatFocusTime } from "@/lib/data/focusAnalytics";
import { FocusSession, focusSessionRepository } from "@/lib/data/focusSessionRepository";

function BarChart({ data, color = "#b9f36b", compact = false }: { data: { label: string; key?: string; seconds: number }[]; color?: string; compact?: boolean }) {
  const max = Math.max(1, ...data.map((item) => item.seconds));
  return <div className={`analytics-bars ${compact ? "compact" : ""}`}>{data.map((item) => <div className="analytics-bar-column" key={item.key || item.label} title={`${item.label}: ${formatFocusTime(item.seconds)}`}><div className="analytics-bar-track"><div className="analytics-bar-fill" style={{ height: `${item.seconds ? Math.max(3, item.seconds / max * 100) : 0}%`, background: color }} /></div><span>{item.label}</span></div>)}</div>;
}

function Distribution({ data, total }: { data: { name: string; seconds: number; percent?: number }[]; total: number }) {
  const colors = ["#b9f36b", "#77b9ef", "#edc95d", "#d890ef", "#f18b76"];
  if (!total) return <div className="analytics-empty">Complete a focus session to see your distribution.</div>;
  return <div className="distribution-list">{data.map((item, index) => <div className="distribution-row" key={item.name}><span className="distribution-dot" style={{ background: colors[index % colors.length] }} /><span className="distribution-name">{item.name}</span><div className="distribution-track"><i style={{ width: `${Math.min(100, item.seconds / total * 100)}%`, background: colors[index % colors.length] }} /></div><span className="distribution-time">{formatFocusTime(item.seconds)}</span><b>{Math.round(item.seconds / total * 100)}%</b></div>)}</div>;
}

function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Clock3 }) {
  return <article className="card analytics-stat"><div className="analytics-stat-head"><span>{label}</span><i><Icon size={14} /></i></div><strong>{value}</strong><small>{note}</small></article>;
}

export default function FocusAnalyticsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [range, setRange] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    focusSessionRepository.list().then(setSessions).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to read saved focus sessions.")).finally(() => setLoading(false));
  }, []);
  const analytics = useMemo(() => buildAnalytics(sessions), [sessions]);
  const trend = range === "week" ? analytics.weekly : analytics.monthly;
  const trendTotal = range === "week" ? analytics.totals.week : analytics.totals.month;
  const change = analytics.weeklyChange;
  const hasData = analytics.totals.all > 0;

  return <main className="analytics-page"><header className="focus-topbar"><Link href="/focus" className="focus-back"><ArrowLeft size={15} /> Focus room</Link><div className="focus-brand"><span>श</span> SHUNYA <small>FOCUS ANALYTICS</small></div><Link href="/focus/history" className="focus-chapters-link"><Clock3 size={13} /> History</Link></header><div className="analytics-content">
    <div className="analytics-hero"><div><div className="focus-kicker"><Activity size={12} /> YOUR STUDY DATA · LIVE FROM SAVED SESSIONS</div><h1>Focus, made visible.</h1><p>Understand where your time goes, using only your recorded focus sessions.</p></div><Link href="/focus/tools" className="analytics-action">Open timers <ArrowUpRight size={13} /></Link></div>
    {!loading && !hasData && <div className="analytics-empty-banner"><Clock3 size={16} /><div><strong>No focus data yet</strong><span>Start a focus timer and complete or interrupt a session to see your actual analytics.</span></div></div>}
    <section className="analytics-stat-grid"><StatCard label="FOCUSED TODAY" value={formatFocusTime(analytics.totals.today)} note="Active focus seconds" icon={Clock3}/><StatCard label="THIS WEEK" value={formatFocusTime(analytics.totals.week)} note="Monday through today" icon={CalendarDays}/><StatCard label="THIS MONTH" value={formatFocusTime(analytics.totals.month)} note="Month to date" icon={TrendingUp}/><StatCard label="DAILY AVERAGE" value={formatFocusTime(analytics.totals.averageDay)} note="Across days with focus records" icon={Activity}/></section>
    <section className="analytics-stat-grid analytics-stat-grid-small"><StatCard label="COMPLETED" value={String(analytics.counts.completed)} note="Finished focus sessions" icon={BookOpen}/><StatCard label="INTERRUPTED" value={String(analytics.counts.interrupted)} note="Partial focus sessions" icon={Flame}/><StatCard label="COMPLETION RATE" value={hasData ? `${analytics.counts.completionRate}%` : "—"} note="Completed / completed + interrupted" icon={PieChart}/></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>{range === "week" ? "Weekly productivity" : "Monthly study trend"}</h2><p>{formatFocusTime(trendTotal)} of focus in this {range}</p></div><div className="analytics-toggle"><button className={range === "week" ? "selected" : ""} onClick={() => setRange("week")}>Weekly</button><button className={range === "month" ? "selected" : ""} onClick={() => setRange("month")}>Monthly</button></div></div><BarChart data={trend} compact={range === "month"}/><div className="chart-caption">{change === null ? "Weekly comparison will appear after your previous week has recorded focus." : `This week ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% compared with last week.`}</div></article>
      <article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Daily focus · this week</h2><p>Active focused time by day</p></div><CalendarDays size={14}/></div><BarChart data={analytics.daily}/><div className="chart-caption">{analytics.productiveDay ? `Most productive: ${analytics.productiveDay.label} (${formatFocusTime(analytics.productiveDay.seconds)}).` : "Your daily focus history will appear here."}</div></article></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Subject distribution</h2><p>Share of recorded focus time</p></div><PieChart size={14}/></div><Distribution data={analytics.subjects} total={analytics.totals.all}/><div className="insight-pair"><span>Most studied <b>{analytics.mostStudiedSubject || "—"}</b></span><span>Least studied* <b>{analytics.leastStudiedSubject || "—"}</b></span></div><small className="analytics-footnote">*Least studied among subjects with recorded sessions.</small></article>
      <article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Theory vs practice</h2><p>Activity distribution · real session labels</p></div><Activity size={14}/></div><Distribution data={analytics.activities} total={analytics.totals.all}/></article></section>
    <section className="analytics-chart-grid"><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Chapter focus</h2><p>Time by chapter · missing names grouped separately</p></div><BookOpen size={14}/></div><Distribution data={analytics.chapters.slice(0,8)} total={analytics.totals.all}/></article><article className="card analytics-panel"><div className="analytics-panel-head"><div><h2>Topic focus</h2><p>Highest and lowest recorded attention</p></div><Flame size={14}/></div>{analytics.topics.length ? <><Distribution data={analytics.topics.slice(0,8)} total={analytics.totals.all}/><div className="insight-pair"><span>Most studied <b>{analytics.topics[0]?.name}</b></span><span>Least studied* <b>{analytics.topics[analytics.topics.length - 1]?.name}</b></span></div></> : <div className="analytics-empty">Topic insights appear when sessions include a topic.</div>}</article></section>
    <section className="card insights-panel"><div className="analytics-panel-head"><div><h2>Smart insights</h2><p>Observations from the sessions you have saved</p></div><Activity size={14}/></div><div className="insight-grid">{analytics.mostStudiedSubject && <div><span>MOST STUDIED SUBJECT</span><strong>{analytics.mostStudiedSubject}</strong></div>}{analytics.leastStudiedSubject && <div><span>LEAST STUDIED SUBJECT WITH DATA</span><strong>{analytics.leastStudiedSubject}</strong></div>}{analytics.productiveDay && <div><span>MOST PRODUCTIVE DAY THIS WEEK</span><strong>{analytics.productiveDay.label} · {formatFocusTime(analytics.productiveDay.seconds)}</strong></div>}<div><span>WEEK-OVER-WEEK</span><strong>{change === null ? "Need previous-week data" : `${change >= 0 ? "+" : ""}${change}% focus time`}</strong></div></div><p className="insight-disclaimer">Topic performance and neglected chapter scoring require test-attempt data, which is not yet available. Zero-time chapters/topics are shown only when they exist in saved sessions.</p></section>
    {loading && <div className="analytics-loading">Loading saved focus data…</div>}{error && <div className="focus-error" role="alert">{error}</div>}
    <footer className="analytics-footer"><span>SHUNYA · NO SAMPLE ANALYTICS</span><span>{analytics.records.length} unique focus records included</span></footer>
  </div></main>;
}
