"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Download, Search } from "lucide-react";
import { ANALYTICS_ACTIVITIES, ANALYTICS_SUBJECTS, filterFocusSessions, formatFocusTime, uniqueFocusSessions } from "@/lib/data/focusAnalytics";
import { FocusSession, focusSessionRepository } from "@/lib/data/focusSessionRepository";

export default function FocusHistoryPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [activity, setActivity] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { focusSessionRepository.list().then(setSessions).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load session history.")); }, []);
  const filtered = useMemo(() => filterFocusSessions(uniqueFocusSessions(sessions), { from: from || undefined, to: to || undefined, subject: subject || undefined, activity: activity || undefined }).filter((session) => !query.trim() || [session.subject, session.chapter, session.topic].some((item) => item.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [sessions, from, to, subject, activity, query]);
  function exportCsv() {
    const header = ["Date", "Started", "Subject", "Chapter", "Topic", "Activity", "Mode", "Focused seconds", "Status"];
    const rows = filtered.map((item) => [new Date(item.startedAt).toLocaleDateString(), new Date(item.startedAt).toLocaleTimeString(), item.subject, item.chapter, item.topic, item.activity, item.mode, String(item.focusedSeconds), item.status]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "shunya-focus-history.csv"; anchor.click(); URL.revokeObjectURL(url);
  }
  const total = filtered.reduce((sum, session) => sum + session.focusedSeconds, 0);
  return <main className="analytics-page"><header className="focus-topbar"><Link href="/focus/analytics" className="focus-back"><ArrowLeft size={15}/> Analytics</Link><div className="focus-brand"><span>श</span> SHUNYA <small>SESSION HISTORY</small></div><button className="history-export" onClick={exportCsv} disabled={!filtered.length}><Download size={13}/> Export CSV</button></header><div className="analytics-content"><div className="analytics-hero"><div><div className="focus-kicker"><Clock3 size={12}/> YOUR RECORDED FOCUS</div><h1>Every session, accounted for.</h1><p>Filter saved records by date, subject, activity, or study topic.</p></div><Link href="/focus/analytics" className="analytics-action">Analytics <ArrowLeft size={13}/></Link></div>
    <section className="card history-filter-panel"><label><span>From</span><input type="date" value={from} onChange={(event)=>setFrom(event.target.value)}/></label><label><span>To</span><input type="date" value={to} onChange={(event)=>setTo(event.target.value)}/></label><label><span>Subject</span><select value={subject} onChange={(event)=>setSubject(event.target.value)}><option value="">All subjects</option>{ANALYTICS_SUBJECTS.map((item)=><option key={item}>{item}</option>)}</select></label><label><span>Activity</span><select value={activity} onChange={(event)=>setActivity(event.target.value)}><option value="">All activities</option>{ANALYTICS_ACTIVITIES.map((item)=><option key={item}>{item}</option>)}</select></label><label className="history-search"><span>Search</span><div><Search size={13}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Chapter or topic"/></div></label><div className="history-total"><b>{filtered.length}</b> sessions · {formatFocusTime(total)} focus</div></section>
    <section className="card history-table-card"><div className="history-table-wrap"><table className="history-table"><thead><tr><th>Date & time</th><th>Subject</th><th>Chapter / topic</th><th>Activity</th><th>Focused</th><th>Status</th></tr></thead><tbody>{filtered.map((session)=><tr key={session.id}><td><strong>{new Date(session.startedAt).toLocaleDateString()}</strong><small>{new Date(session.startedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></td><td>{session.subject || "Unspecified"}</td><td><strong>{session.chapter || "Unspecified chapter"}</strong><small>{session.topic || "Unspecified topic"}</small></td><td>{session.activity}</td><td>{formatFocusTime(session.focusedSeconds)}</td><td><span className={`history-pill ${session.status}`}>{session.status}</span></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="analytics-empty">No sessions match these filters. Completed and interrupted timer records appear here.</div>}</div></section>
    {error && <div className="focus-error" role="alert">{error}</div>}<footer className="analytics-footer"><span>Data is read from the existing focus session store.</span><span>{filtered.length} records shown</span></footer></div></main>;
}
