"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clock3, Coffee, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Chapter, chapterRepository, chapterSubjects, StudySubject } from "@/lib/data/chapterRepository";
import { FocusActivity, FocusSession, focusSessionRepository } from "@/lib/data/focusSessionRepository";

type TimerMode = "pomodoro" | "custom";
type TimerStatus = "idle" | "running" | "paused";
const activities: FocusActivity[] = ["Theory", "Numericals", "PYQs", "Practice", "Revision"];

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 3600)).padStart(2, "0")}:${String(Math.floor((safe % 3600) / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
function labelDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export default function FocusPage() {
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [customMinutes, setCustomMinutes] = useState(45);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [phaseSeconds, setPhaseSeconds] = useState(25 * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [subject, setSubject] = useState<StudySubject>("Physics");
  const [chapterId, setChapterId] = useState("");
  const [topic, setTopic] = useState("");
  const [activity, setActivity] = useState<FocusActivity>("Theory");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(Date.now());
  const startedAtRef = useRef<string | null>(null);
  const runningSinceRef = useRef<number | null>(null);
  const elapsedBaseRef = useRef(0);
  const statusRef = useRef<TimerStatus>("idle");
  const sessionContextRef = useRef({ mode, subject, chapterId, topic, activity });
  const savedRunRef = useRef(false);

  const selectedChapter = chapters.find((chapter) => chapter.id === chapterId);
  const relevantChapters = useMemo(() => chapters.filter((chapter) => chapter.subject === subject), [chapters, subject]);

  useEffect(() => {
    sessionContextRef.current = { mode, subject, chapterId, topic, activity };
  }, [mode, subject, chapterId, topic, activity]);

  useEffect(() => {
    Promise.all([chapterRepository.list(), focusSessionRepository.list()])
      .then(([loadedChapters, loadedHistory]) => { setChapters(loadedChapters); setHistory(loadedHistory); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load saved focus data."))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (relevantChapters.length && !relevantChapters.some((item) => item.id === chapterId)) setChapterId(relevantChapters[0].id);
  }, [relevantChapters, chapterId]);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [status]);

  const currentElapsed = status === "running" && runningSinceRef.current !== null
    ? elapsedBaseRef.current + Math.max(0, Math.floor((now - runningSinceRef.current) / 1000))
    : elapsedBaseRef.current;
  const remaining = Math.max(0, phaseSeconds - currentElapsed);

  const appendSession = useCallback((sessionStatus: "completed" | "interrupted", seconds: number) => {
    if (savedRunRef.current || !startedAtRef.current) return;
    const context = sessionContextRef.current;
    const chapter = chapters.find((item) => item.id === context.chapterId);
    const record: FocusSession = {
      id: crypto.randomUUID(), mode: context.mode, subject: chapter?.subject ?? context.subject,
      chapter: chapter?.name ?? "", topic: context.topic.trim(), activity: context.activity,
      startedAt: startedAtRef.current, endedAt: new Date().toISOString(), focusedSeconds: Math.max(0, Math.floor(seconds)), status: sessionStatus
    };
    savedRunRef.current = true;
    void focusSessionRepository.add(record).then(() => setHistory((previous) => [...previous, record]))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Focus session could not be saved."));
  }, [chapters]);

  const finalizeFocus = useCallback((sessionStatus: "completed" | "interrupted", seconds: number) => {
    appendSession(sessionStatus, seconds);
    runningSinceRef.current = null;
    elapsedBaseRef.current = 0;
    setElapsedSeconds(Math.max(0, Math.floor(seconds)));
    setStatus("idle"); statusRef.current = "idle";
  }, [appendSession]);

  useEffect(() => {
    if (status !== "running" || phase !== "focus" || remaining > 0) return;
    const completedSeconds = phaseSeconds;
    appendSession("completed", completedSeconds);
    runningSinceRef.current = null;
    elapsedBaseRef.current = 0;
    setElapsedSeconds(completedSeconds);
    if (mode === "pomodoro") {
      setPhase("break"); setPhaseSeconds(breakMinutes * 60); setStatus("idle"); statusRef.current = "idle";
      setToast("Focus block complete. Take a well-earned break.");
    } else {
      setStatus("idle"); statusRef.current = "idle"; setToast("Focus session complete. Nice work.");
    }
    window.setTimeout(() => setToast(""), 2800);
  }, [status, phase, remaining, phaseSeconds, mode, breakMinutes, appendSession]);

  useEffect(() => {
    const onPageHide = () => {
      if (statusRef.current !== "running" || runningSinceRef.current === null) return;
      const context = sessionContextRef.current;
      if (context.mode === "pomodoro" && phase !== "focus") return;
      const seconds = elapsedBaseRef.current + Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000));
      if (startedAtRef.current && !savedRunRef.current) {
        const chapter = chapters.find((item) => item.id === context.chapterId);
        const session: FocusSession = { id: crypto.randomUUID(), mode: context.mode, subject: chapter?.subject ?? context.subject,
          chapter: chapter?.name ?? "", topic: context.topic.trim(), activity: context.activity, startedAt: startedAtRef.current,
          endedAt: new Date().toISOString(), focusedSeconds: seconds, status: "interrupted" };
        try {
          const key = "shunya-focus-sessions-v1";
          const raw = window.localStorage.getItem(key);
          const entries: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(entries)) window.localStorage.setItem(key, JSON.stringify([...entries, session]));
        } catch { /* Leave existing session data untouched if it cannot be parsed. */ }
      }
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [chapters, phase]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function chooseMode(next: TimerMode) {
    if (status !== "idle") return notify("Finish or interrupt the current session before changing timer mode.");
    setMode(next); setPhase("focus"); setElapsedSeconds(0); elapsedBaseRef.current = 0; savedRunRef.current = false;
    setPhaseSeconds((next === "pomodoro" ? workMinutes : customMinutes) * 60);
  }
  function begin() {
    if (!ready) return;
    if (!chapterId) return notify("Please add a chapter in Chapter Zones before starting.");
    if (status === "paused") {
      runningSinceRef.current = Date.now(); setStatus("running"); statusRef.current = "running"; setNow(Date.now()); return;
    }
    if (phase === "break") {
      setPhase("focus"); setPhaseSeconds(workMinutes * 60); elapsedBaseRef.current = 0; setElapsedSeconds(0); savedRunRef.current = false;
    }
    startedAtRef.current = new Date().toISOString(); runningSinceRef.current = Date.now(); elapsedBaseRef.current = 0; setElapsedSeconds(0); savedRunRef.current = false;
    setStatus("running"); statusRef.current = "running"; setNow(Date.now());
  }
  function pause() {
    if (status !== "running" || runningSinceRef.current === null) return;
    const activeSeconds = elapsedBaseRef.current + Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000));
    elapsedBaseRef.current = activeSeconds; setElapsedSeconds(activeSeconds); runningSinceRef.current = null;
    setStatus("paused"); statusRef.current = "paused";
  }
  function interrupt() {
    if (status === "idle") return;
    const seconds = status === "running" && runningSinceRef.current !== null
      ? elapsedBaseRef.current + Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000)) : elapsedBaseRef.current;
    if (phase === "focus" && seconds > 0) finalizeFocus("interrupted", seconds);
    else { setStatus("idle"); statusRef.current = "idle"; runningSinceRef.current = null; elapsedBaseRef.current = 0; }
    setPhase("focus"); setPhaseSeconds((mode === "pomodoro" ? workMinutes : customMinutes) * 60);
    notify(seconds > 0 ? "Session interrupted and saved. Paused time was not counted." : "Timer reset.");
  }
  function reset() {
    if (status !== "idle") { interrupt(); return; }
    setPhase("focus"); setElapsedSeconds(0); elapsedBaseRef.current = 0; setPhaseSeconds((mode === "pomodoro" ? workMinutes : customMinutes) * 60); savedRunRef.current = false; startedAtRef.current = null;
  }
  function updateDuration(field: "work" | "break" | "custom", value: number) {
    if (!Number.isFinite(value)) return;
    const limits = field === "work" ? [1, 120] : field === "break" ? [1, 60] : [1, 240];
    const safe = Math.min(limits[1], Math.max(limits[0], Math.floor(value)));
    if (field === "work") { setWorkMinutes(safe); if (mode === "pomodoro" && phase === "focus" && status === "idle") setPhaseSeconds(safe * 60); }
    if (field === "break") { setBreakMinutes(safe); if (phase === "break" && status === "idle") setPhaseSeconds(safe * 60); }
    if (field === "custom") { setCustomMinutes(safe); if (mode === "custom" && status === "idle") setPhaseSeconds(safe * 60); }
  }
  const totalHistorySeconds = history.reduce((sum, item) => sum + item.focusedSeconds, 0);
  const completeCount = history.filter((item) => item.status === "completed").length;

  return <main className="focus-page">
    <header className="focus-topbar"><Link href="/" className="focus-back"><ArrowLeft size={15} /> Planner</Link><div className="focus-brand"><span>श</span> SHUNYA <small>FOCUS ROOM</small></div><Link href="/chapters" className="focus-chapters-link"><BookOpen size={13} /> Chapters</Link></header>
    <div className="focus-content-page">
      <div className="focus-intro"><div><div className="focus-kicker"><Sparkles size={12} /> YOUR SPACE TO DO DEEP WORK</div><h1>Focus, one session at a time.</h1><p>Choose your timer, set an intention, and give the next block your attention.</p></div><div className="focus-saved"><span /> Session history saves on this device</div></div>
      <div className="focus-mode-tabs"><button className={mode === "pomodoro" ? "active" : ""} onClick={() => chooseMode("pomodoro")}><span className="mode-icon"><RotateCcw size={14} /></span><span><b>Pomodoro</b><small>Work and restorative break</small></span></button><button className={mode === "custom" ? "active" : ""} onClick={() => chooseMode("custom")}><span className="mode-icon"><Clock3 size={14} /></span><span><b>Custom focus</b><small>Set a duration that fits</small></span></button></div>
      <section className="focus-layout">
        <article className="focus-timer-card card">
          <div className="timer-card-head"><div><span className="timer-phase-pill">{mode === "pomodoro" ? phase === "focus" ? <><span className="live-dot" /> FOCUS BLOCK</> : <><Coffee size={12} /> BREAK TIME</> : <><span className="live-dot" /> CUSTOM FOCUS</>}</span><h2>{status === "running" ? phase === "break" ? "Rest and recharge" : "Stay with it." : status === "paused" ? "Paused—take your time." : phase === "break" ? "A little reset." : "Ready when you are."}</h2></div><div className={`timer-state ${status}`}>{status === "running" ? "IN SESSION" : status === "paused" ? "PAUSED" : "READY"}</div></div>
          <div className={`timer-dial ${status === "running" ? "is-running" : ""}`}><svg viewBox="0 0 260 260" aria-hidden="true"><circle className="dial-track" cx="130" cy="130" r="116" /><circle className="dial-progress" cx="130" cy="130" r="116" strokeDasharray={`${2 * Math.PI * 116}`} strokeDashoffset={`${2 * Math.PI * 116 * (1 - (phaseSeconds ? currentElapsed / phaseSeconds : 0))}`} /></svg><div className="timer-readout"><strong>{formatClock(remaining)}</strong><span>{phase === "break" ? "BREAK REMAINING" : status === "running" ? "FOCUSING" : status === "paused" ? "PAUSED" : "TIME TO FOCUS"}</span></div></div>
          <div className="timer-controls">{status === "running" ? <button className="timer-primary" onClick={pause}><Pause size={16} fill="currentColor" /> Pause</button> : <button className="timer-primary" onClick={begin} disabled={!ready || !chapterId}><Play size={16} fill="currentColor" /> {status === "paused" ? "Resume focus" : phase === "break" ? "Start break" : "Start focus"}</button>}{(status !== "idle" || elapsedSeconds > 0) && <button className="timer-secondary" onClick={interrupt}><Square size={13} fill="currentColor" /> End session</button>}<button className="timer-reset" aria-label="Reset timer" title="Reset timer" onClick={reset}><RotateCcw size={15} /></button></div>
          {mode === "pomodoro" ? <div className="duration-settings"><label>Focus <input aria-label="Pomodoro focus duration in minutes" type="number" min="1" max="120" value={workMinutes} disabled={status !== "idle"} onChange={(event) => updateDuration("work", Number(event.target.value))} /><span>min</span></label><span className="settings-divider" /><label>Break <input aria-label="Pomodoro break duration in minutes" type="number" min="1" max="60" value={breakMinutes} disabled={status !== "idle"} onChange={(event) => updateDuration("break", Number(event.target.value))} /><span>min</span></label></div> : <div className="duration-settings custom-duration"><label>Focus duration <input aria-label="Custom focus duration in minutes" type="number" min="1" max="240" value={customMinutes} disabled={status !== "idle"} onChange={(event) => updateDuration("custom", Number(event.target.value))} /><span>min</span></label><span className="duration-hint">1–240 minutes</span></div>}
          {phase === "break" && mode === "pomodoro" && <p className="break-note">Your focus block was saved. Break time is excluded from study analytics.</p>}
        </article>
        <aside className="focus-side">
          <section className="card intention-card"><div className="side-card-heading"><div><span className="side-heading-icon"><BookOpen size={14} /></span><div><h2>Session intention</h2><p>What are you working on?</p></div></div></div><div className="intention-fields"><label>Subject<select value={subject} disabled={status !== "idle"} onChange={(event) => { setSubject(event.target.value as StudySubject); setChapterId(""); }}><option value="">Select subject</option>{chapterSubjects.map((item) => <option key={item}>{item}</option>)}</select></label><label>Chapter<select value={chapterId} disabled={status !== "idle" || !relevantChapters.length} onChange={(event) => setChapterId(event.target.value)}><option value="">Select chapter</option>{relevantChapters.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Topic <span>OPTIONAL</span><input value={topic} disabled={status !== "idle"} onChange={(event) => setTopic(event.target.value)} maxLength={70} placeholder="e.g. Electric potential" /></label><label>Activity<select value={activity} disabled={status !== "idle"} onChange={(event) => setActivity(event.target.value as FocusActivity)}>{activities.map((item) => <option key={item}>{item}</option>)}</select></label></div>{!ready ? <div className="focus-help">Loading your saved chapters…</div> : !relevantChapters.length ? <div className="focus-help">No {subject} chapters found. Add one in <Link href="/chapters">Chapter Zones</Link> first.</div> : <div className="intention-confirm"><Check size={12} />{selectedChapter?.name || "Choose a chapter"} · {activity}</div>}</section>
          <section className="card focus-history-card"><div className="side-card-heading"><div><span className="side-heading-icon"><Clock3 size={14} /></span><div><h2>Focus history</h2><p>Saved sessions on this device</p></div></div></div><div className="history-stats"><div><strong>{durationLabel(totalHistorySeconds)}</strong><span>FOCUSED TIME</span></div><div><strong>{history.length}</strong><span>SESSIONS</span></div><div><strong>{history.length ? `${Math.round(completeCount / history.length * 100)}%` : "—"}</strong><span>COMPLETED</span></div></div>{history.length === 0 ? <div className="history-empty">No sessions yet. Your completed or interrupted focus blocks will appear here.</div> : <div className="history-list">{[...history].reverse().slice(0, 5).map((item) => <article className="history-row" key={item.id}><span className={`history-status ${item.status}`} /><div><strong>{item.chapter || item.subject}</strong><span>{item.subject} · {item.activity} · {item.topic || item.mode === "pomodoro" ? item.topic || "Pomodoro" : "Custom focus"}</span></div><b>{labelDuration(item.focusedSeconds)}</b></article>)}</div>}</section>
        </aside>
      </section>
      <p className="focus-footnote"><Clock3 size={12} /> Only active focus seconds are recorded. Paused time and Pomodoro breaks are excluded. Your planner and chapter data are unchanged.</p>
      {error && <div className="focus-error" role="alert">{error}</div>}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
