"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Flame, LayoutDashboard,
  ListTodo, Menu, Moon, Plus, Settings, Sun, Target, Timer, Trash2, X, Pencil, RotateCcw
} from "lucide-react";
import StudentProfileForm from "@/components/StudentProfileForm";
import { loadStudentProfile, saveStudentProfile, StudentProfile, StudentProfileLoadResult } from "@/lib/data/studentProfileRepository";

type Kind = "session" | "checklist" | "todo";
type Priority = "High" | "Medium" | "Low";
type Status = "planned" | "completed" | "partial" | "missed";
type PlannerItem = {
  id: string;
  kind: Kind;
  title: string;
  subject: string;
  chapter: string;
  topic: string;
  date: string;
  start: string;
  end: string;
  priority: Priority;
  status: Status;
};
type Persisted = { items: PlannerItem[]; goalHours: number; lightMode: boolean };

const STORAGE_KEY = "shunya-planner-v1";
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"];
const priorities: Priority[] = ["High", "Medium", "Low"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function fromDateKey(key: string) { return new Date(`${key}T12:00:00`); }
function addDays(key: string, amount: number) { const date = fromDateKey(key); date.setDate(date.getDate() + amount); return dateKey(date); }
function formatDate(key: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" }) {
  return fromDateKey(key).toLocaleDateString(undefined, options);
}
function weekStart(key: string) { const date = fromDateKey(key); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return dateKey(date); }
function duration(item: PlannerItem) {
  if (!item.start || !item.end) return 0;
  const [sh, sm] = item.start.split(":").map(Number); const [eh, em] = item.end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - sh * 60 - sm);
}
function durationLabel(minutes: number) { return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`; }

const navItems = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Day planner", icon: CalendarDays },
  { label: "Chapter zones", icon: Activity }, { label: "Focus room", icon: Timer },
  { label: "Tests & mocks", icon: BookOpen }, { label: "Mistake vault", icon: Circle },
  { label: "Revision", icon: RotateCcw }
];

export default function StudyOS() {
  const today = useMemo(() => dateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [goalHours, setGoalHours] = useState(6);
  const [lightMode, setLightMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileState, setProfileState] = useState<StudentProfileLoadResult>({ profile: null, invalid: false });
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [view, setView] = useState<"day" | "week">("day");
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [checkText, setCheckText] = useState("");
  const [todoText, setTodoText] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Persisted>;
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (typeof parsed.goalHours === "number" && parsed.goalHours > 0) setGoalHours(parsed.goalHours);
        if (typeof parsed.lightMode === "boolean") setLightMode(parsed.lightMode);
      }
    } catch { setToast("Saved planner data could not be read. You can continue with a fresh planner."); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const result = loadStudentProfile();
    setProfileState(result);
    setStudentProfile(result.profile);
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, goalHours, lightMode } satisfies Persisted));
  }, [items, goalHours, lightMode, hydrated]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  const dayItems = items.filter((item) => item.date === selectedDate);
  const sessions = dayItems.filter((item) => item.kind === "session").sort((a, b) => a.start.localeCompare(b.start));
  const checklist = dayItems.filter((item) => item.kind === "checklist");
  const todos = dayItems.filter((item) => item.kind === "todo");
  const completeMinutes = sessions.filter((item) => item.status === "completed").reduce((sum, item) => sum + duration(item), 0);
  const plannedMinutes = sessions.reduce((sum, item) => sum + duration(item), 0);
  const doneCount = dayItems.filter((item) => item.status === "completed").length;
  const progress = dayItems.length ? Math.round(doneCount / dayItems.length * 100) : 0;
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart(selectedDate), index));

  function clearForm() { setSessionTitle(""); setChapter(""); setTopic(""); setStart("09:00"); setEnd("10:00"); setPriority("Medium"); setEditing(null); setShowSessionForm(false); }
  function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = sessionTitle.trim();
    if (!title) return notify("Add a session title before saving.");
    if (!chapter.trim()) return notify("Please add a chapter for this session.");
    if (!start || !end || end <= start) return notify("End time must be later than start time.");
    const collision = items.some((item) => item.kind === "session" && item.date === selectedDate && item.id !== editing && item.start < end && item.end > start);
    if (collision) return notify("This time overlaps another study session. Choose a different time.");
    const updated: PlannerItem = { id: editing || crypto.randomUUID(), kind: "session", title, subject, chapter: chapter.trim(), topic: topic.trim(), date: selectedDate, start, end, priority, status: "planned" };
    setItems((current) => editing ? current.map((item) => item.id === editing ? { ...updated, status: item.status } : item) : [...current, updated]);
    clearForm(); notify(editing ? "Study session updated." : "Study session added to your plan.");
  }
  function editSession(item: PlannerItem) {
    setEditing(item.id); setSessionTitle(item.title); setSubject(item.subject); setChapter(item.chapter); setTopic(item.topic); setStart(item.start); setEnd(item.end); setPriority(item.priority); setShowSessionForm(true);
    document.getElementById("session-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function addSimpleItem(kind: "checklist" | "todo", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = (kind === "checklist" ? checkText : todoText).trim();
    if (!title) return notify("Enter a task before adding it.");
    setItems((current) => [...current, { id: crypto.randomUUID(), kind, title, subject: "", chapter: "", topic: "", date: selectedDate, start: "", end: "", priority: "Medium", status: "planned" }]);
    if (kind === "checklist") setCheckText(""); else setTodoText("");
  }
  function updateStatus(item: PlannerItem, status: Status) { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry)); }
  function removeItem(item: PlannerItem) { setItems((current) => current.filter((entry) => entry.id !== item.id)); }
  function reschedule(item: PlannerItem) { const next = addDays(selectedDate, 1); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, date: next, status: "planned" } : entry)); notify(`Moved to ${formatDate(next)}.`); }
  function moveWeek(amount: number) { setSelectedDate(addDays(selectedDate, amount * 7)); }
  function saveProfile(input: Omit<StudentProfile, "updatedAt">) {
    const profile = saveStudentProfile(input);
    setStudentProfile(profile);
    setProfileState({ profile, invalid: false });
  }
  function selectNavigation(label: string) { if (label !== "Day planner" && label !== "Overview") notify(`${label} will be added in its implementation phase.`); else if (label === "Overview") notify("Your study planner is ready. Overview analytics will use your saved study data."); setMenuOpen(false); }

  function Sidebar() {
    return <aside className="sidebar">
      <div className="brand"><div className="brand-mark">श</div><div>SHUNYA<small>AI STUDYOS</small></div></div>
      <div className="nav-label">STUDY SPACE</div><nav className="nav-list" aria-label="Study space">
        {navItems.slice(0, 4).map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${label === "Day planner" ? "active" : ""}`} onClick={() => selectNavigation(label)}><Icon size={15} />{label}</button>)}
      </nav>
      <div className="nav-label" style={{ marginTop: 22 }}>PREPARATION</div><nav className="nav-list" aria-label="Preparation">
        {navItems.slice(4).map(({ label, icon: Icon }) => <button key={label} className="nav-item" onClick={() => selectNavigation(label)}><Icon size={15} />{label}{label === "Mistake vault" && <span className="nav-trail">0</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="study-card"><p><Target size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} /> DAILY STUDY GOAL</p><strong>{goalHours} hours</strong><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, completeMinutes / (goalHours * 60) * 100)}%` }} /></div></div>
        <div className="profile"><div className="avatar">{studentProfile?.name.charAt(0).toUpperCase() || "S"}</div><div><strong>{studentProfile?.name || "Student"}</strong><span>{studentProfile ? `${studentProfile.classLevel === "Other" ? studentProfile.classOther || "Other" : studentProfile.classLevel === "Dropper" ? "Dropper" : `Class ${studentProfile.classLevel}`} · This device` : "Personal planner · This device"}</span></div></div>
        <Link href="/settings" className="nav-item"><Settings size={15} /> Settings</Link>
      </div>
    </aside>;
  }

  if (!profileLoaded) return <main className="loading-shade" aria-label="Loading student profile" />;
  if (!studentProfile) return <StudentProfileForm
    mode="onboarding"
    invalidStoredProfile={profileState.invalid}
    onSave={saveProfile}
  />;

  return <div className={`shell ${lightMode ? "light" : ""}`}>
    <Sidebar />
    {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)}><div className="mobile-drawer" onClick={(event) => event.stopPropagation()}><button className="nav-item" onClick={() => setMenuOpen(false)}><X size={15} />Close menu</button><Sidebar /></div></div>}
    <main className="main">
      <header className="topbar"><div className="topbar-left"><button aria-label="Open menu" className="icon-button mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={16} /></button><div className="crumb">Study space <span className="crumb-sep">/</span><b>Day planner</b></div></div><div className="top-actions"><button className="icon-button" aria-label="Toggle color theme" onClick={() => setLightMode((current) => !current)}>{lightMode ? <Moon size={15} /> : <Sun size={15} />}</button><button className="icon-button" aria-label="Notifications" onClick={() => notify("Planner reminders are not enabled yet.")}><Bell size={15} /></button></div></header>
      <div className="page-heading planner-heading"><div><div className="eyebrow">YOUR STUDY SPACE · FLEXIBLE BY DESIGN</div><h1>Make today count <span aria-hidden="true">✳</span></h1><p className="subtitle">A plan that works for you—not the other way around.</p></div><div className="planner-heading-actions"><label className="goal-control"><Target size={14} /><span>Daily goal</span><input aria-label="Daily study goal in hours" type="number" min="1" max="16" step="0.5" value={goalHours} onChange={(event) => { const val = Number(event.target.value); if (val >= 1 && val <= 16) setGoalHours(val); }} /><span>hrs</span></label><button className="primary-button" onClick={() => { setEditing(null); setShowSessionForm((value) => !value); }}><Plus size={15} /> Add session</button></div></div>
      <div className="planner-date-row"><div className="date-navigation"><button className="icon-button" aria-label="Previous week" onClick={() => moveWeek(-1)}><ChevronLeft size={15} /></button><button className="date-current" onClick={() => setSelectedDate(today)}>{formatDate(selectedDate)}{selectedDate === today && <span className="today-tag">TODAY</span>}</button><button className="icon-button" aria-label="Next week" onClick={() => moveWeek(1)}><ChevronRight size={15} /></button></div><div className="view-toggle"><button className={view === "day" ? "selected" : ""} onClick={() => setView("day")}>Day</button><button className={view === "week" ? "selected" : ""} onClick={() => setView("week")}>Week</button></div></div>
      {view === "week" && <section className="week-strip card" aria-label="Weekly calendar"><div className="week-strip-head"><div><h2>This week</h2><p>Select a day to view or plan your sessions</p></div><div className="week-controls"><button className="icon-button" aria-label="Previous week" onClick={() => moveWeek(-1)}><ArrowLeft size={14} /></button><button className="icon-button" aria-label="Next week" onClick={() => moveWeek(1)}><ArrowRight size={14} /></button></div></div><div className="week-days">{weekDays.map((day) => { const daily = items.filter((item) => item.date === day); const count = daily.filter((item) => item.kind === "session").length; return <button key={day} className={`week-day ${selectedDate === day ? "selected" : ""} ${day === today ? "is-today" : ""}`} onClick={() => setSelectedDate(day)}><span>{formatDate(day, { weekday: "short" })}</span><strong>{fromDateKey(day).getDate()}</strong><small>{count ? `${count} ${count === 1 ? "session" : "sessions"}` : "No sessions"}</small><i>{count > 0 && <b style={{ width: `${Math.min(count * 7, 28)}px` }} />}</i></button>; })}</div></section>}
      <section className="summary-grid" aria-label="Daily productivity summary">
        <article className="card summary-card"><span className="summary-icon"><Clock3 size={15} /></span><div><span className="summary-label">COMPLETED STUDY TIME</span><strong>{durationLabel(completeMinutes)}</strong><small>{plannedMinutes ? `${durationLabel(plannedMinutes)} planned` : "Complete a session to track progress"}</small></div></article>
        <article className="card summary-card"><span className="summary-icon"><CheckCircle2 size={15} /></span><div><span className="summary-label">TASKS COMPLETED</span><strong>{doneCount} <em>/ {dayItems.length}</em></strong><small>{dayItems.length ? `${progress}% of today's plan` : "Add your first task"}</small></div></article>
        <article className="card summary-card summary-goal"><span className="summary-icon"><Target size={15} /></span><div className="summary-goal-copy"><span className="summary-label">DAILY STUDY GOAL</span><strong>{Math.floor(completeMinutes / 60)}h {String(completeMinutes % 60).padStart(2, "0")}m <em>/ {goalHours}h</em></strong><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, completeMinutes / (goalHours * 60) * 100)}%` }} /></div><small>{Math.max(0, goalHours * 60 - completeMinutes) ? `${durationLabel(Math.max(0, goalHours * 60 - completeMinutes))} left to goal` : "Daily goal reached — great work!"}</small></div></article>
      </section>
      {showSessionForm && <section id="session-form" className="card session-form-card"><div className="form-heading"><div><span className="eyebrow">PLAN A FOCUS BLOCK</span><h2>{editing ? "Edit study session" : "Add a study session"}</h2></div><button className="icon-button" aria-label="Close form" onClick={clearForm}><X size={15} /></button></div><form onSubmit={saveSession} className="session-form"><label className="field wide">Session name<input autoFocus placeholder="e.g. Work through electrostatics PYQs" maxLength={90} value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} required /></label><label className="field">Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}>{SUBJECTS.map((name) => <option key={name}>{name}</option>)}</select></label><label className="field">Chapter<input placeholder="e.g. Electrostatics" maxLength={60} value={chapter} onChange={(event) => setChapter(event.target.value)} required /></label><label className="field">Topic <span className="optional">optional</span><input placeholder="e.g. Electric potential" maxLength={60} value={topic} onChange={(event) => setTopic(event.target.value)} /></label><label className="field">Start time<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className="field">End time<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label><label className="field">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{priorities.map((name) => <option key={name}>{name}</option>)}</select></label><div className="form-actions"><button className="secondary-button" type="button" onClick={clearForm}>Cancel</button><button className="primary-button" type="submit"><Check size={14} /> {editing ? "Save changes" : "Add to plan"}</button></div></form></section>}

      {view === "week" && <div className="week-date-note"><CalendarDays size={13} /> Showing plan for <strong>{formatDate(selectedDate)}</strong></div>}
      <div className="planner-columns">
        <section className="card planner-panel"><div className="panel-heading"><div><h2>Study sessions</h2><p>{sessions.length ? `${sessions.length} planned block${sessions.length === 1 ? "" : "s"} · ${durationLabel(plannedMinutes)} total` : "Your schedule is yours to shape"}</p></div><button className="text-action" onClick={() => { setEditing(null); setShowSessionForm(true); }}><Plus size={13} /> Add</button></div>
          {sessions.length === 0 ? <div className="empty-state"><span className="empty-icon"><CalendarDays size={20} /></span><strong>No sessions planned yet</strong><p>Build a flexible study day, one focus block at a time.</p><button className="primary-button" onClick={() => setShowSessionForm(true)}><Plus size={14} /> Plan a session</button></div> : <div className="session-list">{sessions.map((item) => <article key={item.id} className={`session-item ${item.status !== "planned" ? `status-${item.status}` : ""}`}><div className="session-time"><strong>{item.start}</strong><span>{item.end} · {durationLabel(duration(item))}</span></div><div className={`session-priority ${item.priority.toLowerCase()}`} title={`${item.priority} priority`} /><div className="session-details"><div className="session-title-row"><strong>{item.title}</strong><span className={`priority-label ${item.priority.toLowerCase()}`}>{item.priority}</span></div><span>{item.subject} <i>·</i> {item.chapter}{item.topic ? ` · ${item.topic}` : ""}</span><div className="session-status-controls"><label htmlFor={`status-${item.id}`}>Status</label><select id={`status-${item.id}`} value={item.status} onChange={(event) => updateStatus(item, event.target.value as Status)}><option value="planned">Planned</option><option value="completed">Completed</option><option value="partial">Partially done</option><option value="missed">Missed</option></select></div></div><div className="session-actions"><button className="icon-button small" aria-label={`Edit ${item.title}`} onClick={() => editSession(item)}><Pencil size={13} /></button><button className="icon-button small" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item)}><Trash2 size={13} /></button>{item.status !== "completed" && <button className="icon-button small" aria-label={`Reschedule ${item.title} to tomorrow`} title="Reschedule to tomorrow" onClick={() => reschedule(item)}><ArrowRight size={13} /></button>}</div></article>)}</div>}
        </section>
        <section className="card planner-panel checklist-panel"><div className="panel-heading"><div><h2>Daily checklist</h2><p>Small wins make a strong day</p></div><span className="count-badge">{checklist.filter((item) => item.status === "completed").length}/{checklist.length}</span></div><form className="inline-add" onSubmit={(event) => addSimpleItem("checklist", event)}><input aria-label="Add checklist item" placeholder="Add a daily checklist item…" maxLength={100} value={checkText} onChange={(event) => setCheckText(event.target.value)} /><button className="icon-button add-icon" aria-label="Add checklist item"><Plus size={15} /></button></form>{checklist.length ? <div className="simple-list">{checklist.map((item) => <div className={`simple-item ${item.status === "completed" ? "is-done" : ""}`} key={item.id}><button className="check-button" aria-label={`${item.status === "completed" ? "Mark incomplete" : "Complete"}: ${item.title}`} onClick={() => updateStatus(item, item.status === "completed" ? "planned" : "completed")}>{item.status === "completed" ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button><span>{item.title}</span><button className="delete-quiet" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item)}><X size={13} /></button></div>)}</div> : <div className="small-empty">No checklist items yet. Add a few daily habits above.</div>}</section>
        <section className="card planner-panel todo-panel"><div className="panel-heading"><div><h2>To-do list</h2><p>Capture the things on your mind</p></div><span className="count-badge">{todos.filter((item) => item.status === "completed").length}/{todos.length}</span></div><form className="inline-add" onSubmit={(event) => addSimpleItem("todo", event)}><input aria-label="Add to-do task" placeholder="Add a task to get it off your mind…" maxLength={100} value={todoText} onChange={(event) => setTodoText(event.target.value)} /><button className="icon-button add-icon" aria-label="Add to-do"><Plus size={15} /></button></form>{todos.length ? <div className="simple-list">{todos.map((item) => <div className={`simple-item ${item.status === "completed" ? "is-done" : ""}`} key={item.id}><button className="check-button" aria-label={`${item.status === "completed" ? "Mark incomplete" : "Complete"}: ${item.title}`} onClick={() => updateStatus(item, item.status === "completed" ? "planned" : "completed")}>{item.status === "completed" ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button><span>{item.title}</span><button className="delete-quiet" aria-label={`Delete ${item.title}`} onClick={() => removeItem(item)}><X size={13} /></button></div>)}</div> : <div className="small-empty">Your task list is clear. Add to-dos whenever you need.</div>}</section>
      </div>
      <footer className="planner-footer"><span>SHUNYA · YOUR STUDY ROUTINE, YOUR RULES</span><span><Flame size={12} /> Keep showing up</span></footer>
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
    {!hydrated && <div className="loading-shade" aria-label="Loading saved planner" />}
  </div>;
}
