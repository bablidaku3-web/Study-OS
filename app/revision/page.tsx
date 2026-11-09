"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, CalendarClock, CalendarDays, Check, CheckCircle2, Clock3, Plus, RotateCcw, SkipForward, Sparkles } from "lucide-react";
import { Chapter, chapterRepository } from "@/lib/data/chapterRepository";
import { MistakeRecord, ExamCategory, mistakeRepository } from "@/lib/data/mistakeRepository";
import { TestAttempt, testRepository } from "@/lib/data/testRepository";
import { addLocalDays, DEFAULT_REVISION_INTERVALS, RevisionEvent, RevisionSchedule, revisionRepository, sortRevisionSchedules, suggestRevisionSchedules, todayLocalDate } from "@/lib/data/revisionRepository";
import styles from "./revision.module.css";

const exams: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];
function dateLabel(date: string | null) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Schedule complete"; }
function emptySchedule() { return { exam: "JEE" as ExamCategory, subject: "Physics", chapter: "", topic: "", intervals: DEFAULT_REVISION_INTERVALS.join(", "), mistakeIds: [] as string[] }; }

export default function RevisionPage() {
  const [schedules, setSchedules] = useState<RevisionSchedule[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [form, setForm] = useState(emptySchedule());
  const [showForm, setShowForm] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<RevisionSchedule | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [duration, setDuration] = useState(30);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [activeFilter, setActiveFilter] = useState("Due Today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([revisionRepository.list(), chapterRepository.list(), mistakeRepository.list(), testRepository.listAttempts()])
      .then(([savedSchedules, savedChapters, savedMistakes, savedAttempts]) => { setSchedules(savedSchedules); setChapters(savedChapters); setMistakes(savedMistakes); setAttempts(savedAttempts); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load revision data."))
      .finally(() => setLoading(false));
  }, []);

  const today = todayLocalDate();
  const suggestions = useMemo(() => suggestRevisionSchedules(schedules, chapters, mistakes, attempts), [schedules, chapters, mistakes, attempts]);
  const active = schedules.filter((item) => item.status === "active");
  const dueToday = sortRevisionSchedules(active.filter((item) => item.nextDueDate === today));
  const overdue = sortRevisionSchedules(active.filter((item) => !!item.nextDueDate && item.nextDueDate < today));
  const upcoming = sortRevisionSchedules(active.filter((item) => !!item.nextDueDate && item.nextDueDate > today));
  const completed = sortRevisionSchedules(schedules.filter((item) => item.status === "completed"));
  const shown = activeFilter === "Due Today" ? dueToday : activeFilter === "Upcoming" ? upcoming : activeFilter === "Overdue" ? overdue : completed;
  const historyEvents = schedules.flatMap((schedule) => schedule.history.map((event) => ({ schedule, event }))).sort((a, b) => b.event.date.localeCompare(a.event.date));
  const completionRate = historyEvents.length ? Math.round(historyEvents.filter((item) => item.event.action === "completed").length / historyEvents.filter((item) => item.event.action !== "rescheduled").length * 100) : 0;
  const weeklyEvents = historyEvents.filter(({ event }) => event.action === "completed" && event.date >= addLocalDays(today, -6) && event.date <= today);
  const selected = schedules.find((item) => item.id === selectedId) || null;

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function updateForm<K extends keyof ReturnType<typeof emptySchedule>>(key: K, value: ReturnType<typeof emptySchedule>[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function createSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chapter = form.chapter.trim(); const subject = form.subject.trim();
    if (!chapter || !subject) return setError("Subject and chapter are required.");
    const intervals = form.intervals.split(",").map((item) => Number(item.trim()));
    if (!intervals.length || intervals.some((item) => !Number.isInteger(item) || item < 1 || item > 365) || intervals.some((item, index) => index > 0 && item <= intervals[index - 1])) {
      return setError("Intervals must be increasing whole days from 1 to 365, separated by commas.");
    }
    const now = new Date().toISOString();
    const schedule: RevisionSchedule = { id: crypto.randomUUID(), exam: form.exam, subject, chapter, topic: form.topic.trim(), intervals, completedCount: 0,
      nextDueDate: today, status: "active", linkedMistakeIds: [...new Set(form.mistakeIds)], createdAt: now, updatedAt: now, history: [] };
    try { await revisionRepository.add(schedule); setSchedules((items) => [...items, schedule]); setSelectedId(schedule.id); setShowForm(false); setForm(emptySchedule()); setError(""); notify("Revision schedule created and due today."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save schedule."); }
  }
  function createFromSuggestion(suggestion: ReturnType<typeof suggestRevisionSchedules>[number]) {
    setForm({ exam: suggestion.exam, subject: suggestion.subject, chapter: suggestion.chapter, topic: suggestion.topic, intervals: DEFAULT_REVISION_INTERVALS.join(", "), mistakeIds: suggestion.mistakeIds });
    setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openRevision(schedule: RevisionSchedule) { setSessionTarget(schedule); setRevisionNote(""); setDuration(30); setShowSession(true); }
  async function saveSchedule(next: RevisionSchedule) {
    try { await revisionRepository.update(next); setSchedules((items) => items.map((item) => item.id === next.id ? next : item)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update revision schedule."); }
  }
  async function completeRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionTarget) return;
    if (!Number.isInteger(duration) || duration < 1 || duration > 600) return setError("Revision duration must be from 1 to 600 minutes.");
    const now = new Date().toISOString();
    const eventItem: RevisionEvent = { id: crypto.randomUUID(), action: "completed", date: today, durationMinutes: duration, note: revisionNote.trim() };
    const nextCount = sessionTarget.completedCount + 1;
    const finished = nextCount >= sessionTarget.intervals.length;
    const nextDate = finished ? null : addLocalDays(today, sessionTarget.intervals[nextCount]);
    const next: RevisionSchedule = { ...sessionTarget, completedCount: nextCount, nextDueDate: nextDate, status: finished ? "completed" : "active", updatedAt: now, history: [...sessionTarget.history, eventItem] };
    await saveSchedule(next); setShowSession(false); setSessionTarget(null); notify(finished ? "All spaced revisions complete. Schedule archived." : `Revision complete. Next review: ${dateLabel(nextDate)}.`);
  }
  async function skipRevision(schedule: RevisionSchedule) {
    const eventItem: RevisionEvent = { id: crypto.randomUUID(), action: "skipped", date: today, durationMinutes: 0, note: "Skipped by student" };
    const nextCount = schedule.completedCount + 1;
    const finished = nextCount >= schedule.intervals.length;
    const nextDate = finished ? null : addLocalDays(today, schedule.intervals[nextCount]);
    await saveSchedule({ ...schedule, completedCount: nextCount, nextDueDate: nextDate, status: finished ? "completed" : "active", updatedAt: new Date().toISOString(), history: [...schedule.history, eventItem] });
    notify("Revision skipped and logged.");
  }
  async function reschedule(schedule: RevisionSchedule) {
    if (!rescheduleValue || rescheduleValue <= today) return setError("Choose a future date to reschedule.");
    const eventItem: RevisionEvent = { id: crypto.randomUUID(), action: "rescheduled", date: today, durationMinutes: 0, note: `Moved to ${rescheduleValue}` };
    await saveSchedule({ ...schedule, nextDueDate: rescheduleValue, updatedAt: new Date().toISOString(), history: [...schedule.history, eventItem] });
    setRescheduleValue(""); notify(`Revision moved to ${dateLabel(rescheduleValue)}.`);
  }
  const linkedMistakes = (schedule: RevisionSchedule) => mistakes.filter((mistake) => schedule.linkedMistakeIds.includes(mistake.id));

  return <main className={styles.page}><header className={styles.topbar}><Link href="/" className={styles.back}><ArrowLeft size={15}/> Planner</Link><div className={styles.brand}><span>श</span> SHUNYA <small>SMART REVISION</small></div><Link href="/mistakes" className={styles.navLink}>Mistake Vault</Link></header><div className={styles.content}>
    <div className={styles.hero}><div><div className={styles.kicker}><Sparkles size={12}/> SPACED REPETITION · YOUR PACE</div><h1>Revision, made manageable.</h1><p>Schedule chapter reviews, capture what you learned, and use your actual zones and recorded mistakes to guide what’s next.</p></div><button className={styles.primary} onClick={() => { setShowForm((open) => !open); setError(""); }}><Plus size={14}/> Schedule revision</button></div>
    <section className={styles.statGrid}><article><CalendarDays size={14}/><b>{historyEvents.filter((item) => item.event.action === "completed").length}</b><span>Revisions completed</span></article><article><Clock3 size={14}/><b>{dueToday.length + upcoming.length}</b><span>Pending active schedules</span></article><article><CalendarClock size={14}/><b>{overdue.length}</b><span>Overdue</span></article><article><CheckCircle2 size={14}/><b>{historyEvents.filter((item) => item.event.action !== "rescheduled").length ? `${completionRate}%` : "—"}</b><span>Completion rate</span></article></section>
    {showForm && <section className={styles.formCard}><div className={styles.formTitle}><div><h2>Create a chapter revision plan</h2><p>Default spacing: 1, 3, 7, 14 and 30 days. Customize as needed.</p></div></div><form onSubmit={createSchedule} className={styles.form}><label>Exam<select value={form.exam} onChange={(event) => updateForm("exam", event.target.value as ExamCategory)}>{exams.map((exam) => <option key={exam}>{exam}</option>)}</select></label><label>Subject<input value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} maxLength={70} required placeholder="Physics, Accounts, Polity…"/></label><label>Chapter<input list="revision-chapters" value={form.chapter} onChange={(event) => updateForm("chapter", event.target.value)} maxLength={100} required placeholder="Chapter or area"/><datalist id="revision-chapters">{chapters.filter((item) => item.subject === form.subject).map((chapter) => <option key={chapter.id} value={chapter.name}/>)}</datalist></label><label>Topic <span>OPTIONAL</span><input value={form.topic} onChange={(event) => updateForm("topic", event.target.value)} maxLength={100}/></label><label className={styles.wide}>Intervals (days, ascending)<input value={form.intervals} onChange={(event) => updateForm("intervals", event.target.value)} placeholder="1, 3, 7, 14, 30" required/><small>Enter whole days in increasing order. The first review is scheduled for today.</small></label><fieldset className={styles.mistakeChoices}><legend>Link unresolved Mistake Vault entries <span>OPTIONAL</span></legend>{mistakes.filter((item) => item.status !== "Resolved" && item.subject.toLowerCase() === form.subject.toLowerCase() && (!form.chapter || item.chapter.toLowerCase() === form.chapter.trim().toLowerCase())).map((item) => <label key={item.id}><input type="checkbox" checked={form.mistakeIds.includes(item.id)} onChange={(event) => updateForm("mistakeIds", event.target.checked ? [...form.mistakeIds, item.id] : form.mistakeIds.filter((id) => id !== item.id))}/><span>{item.category} · {item.topic || item.chapter}</span></label>)}{!mistakes.some((item) => item.status !== "Resolved" && item.subject.toLowerCase() === form.subject.toLowerCase() && (!form.chapter || item.chapter.toLowerCase() === form.chapter.trim().toLowerCase())) && <small>No unresolved saved mistakes match this subject/chapter.</small>}</fieldset><div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className={styles.primary}><Check size={13}/> Create schedule</button></div></form></section>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {suggestions.length > 0 && <section className={styles.suggestions}><div className={styles.sectionTitle}><div><h2>Suggested revisions</h2><p>Based only on saved unresolved mistakes and Yellow/Red chapter zones.</p></div><span>{suggestions.length} suggestions</span></div><div className={styles.suggestionList}>{suggestions.slice(0,6).map((item) => <article key={`${item.exam}-${item.subject}-${item.chapter}`}><div><b>{item.chapter}</b><span>{item.exam} · {item.subject} · {item.reason}{item.mistakeIds.length ? ` · ${item.mistakeIds.length} mistake${item.mistakeIds.length === 1 ? "" : "s"}` : ""}</span></div><button className={styles.secondary} onClick={() => createFromSuggestion(item)}><Plus size={12}/> Schedule</button></article>)}</div></section>}
    <section className={styles.dashboard}><div className={styles.sectionTitle}><div><h2>Revision dashboard</h2><p>All dates use your device’s local calendar.</p></div><span>{schedules.length} schedules</span></div><div className={styles.tabs}>{["Due Today","Upcoming","Overdue","Completed"].map((tab)=><button key={tab} className={activeFilter===tab?styles.activeTab:""} onClick={()=>setActiveFilter(tab)}>{tab}<b>{tab==="Due Today"?dueToday.length:tab==="Upcoming"?upcoming.length:tab==="Overdue"?overdue.length:completed.length}</b></button>)}</div>
      {loading?<div className={styles.empty}>Loading revisions…</div>:shown.length?<div className={styles.scheduleLayout}><div className={styles.scheduleList}>{shown.map((schedule)=><article key={schedule.id} className={`${styles.schedule} ${selectedId===schedule.id?styles.selected:""}`}><button className={styles.scheduleMain} onClick={()=>setSelectedId(schedule.id)}><div className={styles.scheduleTop}><span>{schedule.exam} · {schedule.subject}</span><b>{schedule.status==="completed"?"Completed":dateLabel(schedule.nextDueDate)}</b></div><strong>{schedule.chapter}</strong><span>{schedule.topic||"Chapter revision"} · Review {Math.min(schedule.completedCount+1,schedule.intervals.length)} of {schedule.intervals.length}</span><div className={styles.intervalProgress}>{schedule.intervals.map((_,index)=><i key={index} className={index<schedule.completedCount?styles.intervalDone:""}/>)}</div></button>{schedule.status==="active"&&<div className={styles.scheduleActions}><button onClick={()=>openRevision(schedule)}><CheckCircle2 size={12}/> Revise</button><button onClick={()=>{setSelectedId(schedule.id);setRescheduleValue(addLocalDays(today,1));}}><CalendarClock size={12}/> Reschedule</button><button onClick={()=>void skipRevision(schedule)}><SkipForward size={12}/> Skip</button></div>}</article>)}</div>
        <aside className={styles.detail}>{selected&&shown.some((item)=>item.id===selected.id)?<><div className={styles.detailTitle}><span>{selected.exam} · {selected.subject}</span><h3>{selected.chapter}</h3><p>{selected.topic||"Chapter revision"}</p></div><div className={styles.detailMeta}><span>Next due</span><b>{dateLabel(selected.nextDueDate)}</b><span>Interval plan</span><b>{selected.intervals.join(" · ")} days</b><span>Completed reviews</span><b>{selected.completedCount} / {selected.intervals.length}</b></div>{linkedMistakes(selected).length>0&&<section className={styles.linkedMistakes}><h4><BookOpen size={12}/> Linked mistakes</h4>{linkedMistakes(selected).map((mistake)=><article key={mistake.id}><b>{mistake.topic||mistake.chapter}</b><span>{mistake.category} · {mistake.status}</span><p>{mistake.explanation}</p></article>)}</section>}<section className={styles.revisionHistory}><h4><RotateCcw size={12}/> Revision history</h4>{selected.history.length?selected.history.slice().reverse().map((entry)=><article key={entry.id}><span>{entry.action} · {dateLabel(entry.date)}</span><b>{entry.durationMinutes?`${entry.durationMinutes} min`:"—"}</b>{entry.note&&<p>{entry.note}</p>}</article>):<div>No revision sessions logged yet.</div>}</section>{selected.status==="active"&&rescheduleValue===selected.nextDueDate&&<form className={styles.rescheduleForm} onSubmit={(event)=>{event.preventDefault();void reschedule(selected);}}><label>Move due date<input type="date" min={addLocalDays(today,1)} value={rescheduleValue} onChange={(event)=>setRescheduleValue(event.target.value)}/></label><button className={styles.primary}>Save date</button></form>}</>:<div className={styles.empty}>Select a chapter schedule to see its revision history.</div>}</aside>
      </div>:<div className={styles.empty}><CalendarDays size={20}/><b>No {activeFilter.toLowerCase()} revisions</b><span>{activeFilter==="Due Today"?"Schedule a chapter review or use a data-based suggestion to get started.":"Your real revision schedule will appear here."}</span></div>}</section>
    <section className={styles.weekly}><div className={styles.sectionTitle}><div><h2>This week’s revision activity</h2><p>Completed sessions by local calendar day.</p></div><span>{weeklyEvents.length} completed</span></div><div className={styles.weekBars}>{Array.from({length:7},(_,index)=>{const day=addLocalDays(today,index-6);const count=weeklyEvents.filter(({event})=>event.date===day).length;return <div key={day} title={`${dateLabel(day)}: ${count} revisions`}><i style={{height:`${count?Math.max(8,Math.min(100,count*24)):0}%`}}/><span>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{weekday:"short"})}</span></div>})}</div></section>
    </div>
    {showSession&&sessionTarget&&<div className={styles.modalBackdrop}><form className={styles.modal} onSubmit={completeRevision}><button type="button" className={styles.modalClose} onClick={()=>setShowSession(false)}>×</button><div className={styles.kicker}>REVISION SESSION</div><h2>{sessionTarget.chapter}</h2><p>{sessionTarget.subject} · {sessionTarget.exam}{sessionTarget.topic?` · ${sessionTarget.topic}`:""}</p><label>Duration (minutes)<input type="number" min="1" max="600" value={duration} onChange={(event)=>setDuration(Number(event.target.value))} required/></label><label>Revision notes<textarea rows={4} maxLength={1500} value={revisionNote} onChange={(event)=>setRevisionNote(event.target.value)} placeholder="What did you review? What needs another pass?"/></label><div className={styles.actions}><button type="button" className={styles.secondary} onClick={()=>setShowSession(false)}>Cancel</button><button type="submit" className={styles.primary}><Check size={13}/> Mark complete</button></div></form></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </main>;
}
