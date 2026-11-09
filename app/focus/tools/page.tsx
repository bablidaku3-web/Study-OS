"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, Clock3, Coffee, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Chapter, chapterRepository, chapterSubjects, StudySubject } from "@/lib/data/chapterRepository";
import { FocusActivity, FocusSession, FocusTimerMode, focusSessionRepository } from "@/lib/data/focusSessionRepository";

type ToolMode = Exclude<FocusTimerMode, "pomodoro" | "custom">;
type TimerStatus = "idle" | "running" | "paused";
const activities: FocusActivity[] = ["Theory", "Numericals", "PYQs", "Practice", "Revision"];
const modeLabels: Record<ToolMode, string> = {
  stopwatch: "Stopwatch", countdown: "Countdown", "short-break": "Short break",
  "long-break": "Long break", interval: "Study intervals", revision: "Revision timer"
};
const isBreakMode = (mode: ToolMode) => mode === "short-break" || mode === "long-break";
const modeIsCountdown = (mode: ToolMode) => mode !== "stopwatch";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(value)));
function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 3600)).padStart(2, "0")}:${String(Math.floor((safe % 3600) / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
function displayDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export default function FocusToolsPage() {
  const [mode, setMode] = useState<ToolMode>("stopwatch");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [minutes, setMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [rounds, setRounds] = useState(4);
  const [intervalFocus, setIntervalFocus] = useState(25);
  const [intervalBreak, setIntervalBreak] = useState(5);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [subject, setSubject] = useState<StudySubject>("Physics");
  const [chapterId, setChapterId] = useState("");
  const [topic, setTopic] = useState("");
  const [activity, setActivity] = useState<FocusActivity>("Theory");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const runningSince = useRef<number | null>(null);
  const startedAt = useRef<string | null>(null);
  const elapsedBase = useRef(0);
  const saved = useRef(false);
  const modeRef = useRef<ToolMode>(mode);
  const statusRef = useRef<TimerStatus>(status);
  const configRef = useRef({ minutes, shortBreakMinutes, longBreakMinutes, rounds, intervalFocus, intervalBreak, subject, chapterId, topic, activity });

  useEffect(() => { modeRef.current = mode; statusRef.current = status; }, [mode, status]);
  useEffect(() => { configRef.current = { minutes, shortBreakMinutes, longBreakMinutes, rounds, intervalFocus, intervalBreak, subject, chapterId, topic, activity }; }, [minutes, shortBreakMinutes, longBreakMinutes, rounds, intervalFocus, intervalBreak, subject, chapterId, topic, activity]);
  useEffect(() => {
    Promise.all([chapterRepository.list(), focusSessionRepository.list()])
      .then(([loadedChapters, loadedSessions]) => { setChapters(loadedChapters); setHistory(loadedSessions); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load saved study data."))
      .finally(() => setReady(true));
  }, []);
  const relevantChapters = useMemo(() => chapters.filter((chapter) => chapter.subject === subject), [chapters, subject]);
  const selectedChapter = chapters.find((chapter) => chapter.id === chapterId);
  useEffect(() => { if (relevantChapters.length && !relevantChapters.some((chapter) => chapter.id === chapterId)) setChapterId(relevantChapters[0].id); }, [relevantChapters, chapterId]);
  useEffect(() => {
    if (status !== "running") return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(intervalId);
  }, [status]);

  const liveElapsed = status === "running" && runningSince.current !== null
    ? elapsedBase.current + Math.floor(Math.max(0, now - runningSince.current) / 1000)
    : elapsedBase.current;
  const targetSeconds = mode === "short-break" ? shortBreakMinutes * 60 : mode === "long-break" ? longBreakMinutes * 60 : minutes * 60;
  const intervalTotal = rounds * (intervalFocus + intervalBreak) * 60;
  const intervalFocusSeconds = Math.floor(intervalFocus * 60);
  const intervalBreakSeconds = Math.floor(intervalBreak * 60);
  const intervalCycle = intervalFocusSeconds + intervalBreakSeconds;
  const intervalPosition = intervalCycle ? liveElapsed % intervalCycle : 0;
  const intervalIsBreak = mode === "interval" && liveElapsed < intervalTotal && intervalPosition >= intervalFocusSeconds;
  const intervalDoneFocus = mode === "interval" ? Math.floor(liveElapsed / intervalCycle) * intervalFocusSeconds + Math.min(intervalPosition, intervalFocusSeconds) : liveElapsed;
  const remaining = mode === "stopwatch" ? liveElapsed : mode === "interval" ? Math.max(0, intervalTotal - liveElapsed) : Math.max(0, targetSeconds - liveElapsed);
  const focusedCurrent = isBreakMode(mode) ? 0 : mode === "interval" ? intervalDoneFocus : liveElapsed;
  const phaseRemaining = mode === "interval" && intervalIsBreak ? intervalCycle - intervalPosition : mode === "interval" ? intervalFocusSeconds - intervalPosition : remaining;
  const progressTotal = mode === "stopwatch" ? Math.max(1, liveElapsed) : mode === "interval" ? intervalTotal : targetSeconds;
  const progressElapsed = mode === "interval" ? liveElapsed : liveElapsed;

  const saveSession = useCallback(async (result: "completed" | "interrupted", focusedSeconds: number) => {
    if (saved.current || !startedAt.current) return;
    saved.current = true;
    const config = configRef.current;
    const chapter = chapters.find((item) => item.id === config.chapterId);
    const record: FocusSession = {
      id: crypto.randomUUID(), mode: modeRef.current, subject: chapter?.subject ?? config.subject,
      chapter: chapter?.name ?? "", topic: config.topic.trim(), activity: isBreakMode(modeRef.current) ? "Revision" : config.activity,
      startedAt: startedAt.current, endedAt: new Date().toISOString(), focusedSeconds: Math.max(0, Math.floor(focusedSeconds)), status: result
    };
    try { await focusSessionRepository.add(record); setHistory((previous) => [...previous, record]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The session could not be saved."); saved.current = false; }
  }, [chapters]);

  useEffect(() => {
    if (status !== "running" || !modeIsCountdown(mode) || remaining > 0) return;
    void saveSession("completed", isBreakMode(mode) ? 0 : mode === "interval" ? intervalTotal - rounds * intervalBreak * 60 : targetSeconds);
    elapsedBase.current = 0; runningSince.current = null; setElapsed(0); setStatus("idle"); statusRef.current = "idle";
    notify(`${modeLabels[mode]} complete.`);
    // Completion is triggered exactly once as running transitions to idle.
  }, [status, mode, remaining, intervalTotal, rounds, targetSeconds, saveSession]);

  const interruptOnLeave = useCallback(() => {
    if (statusRef.current !== "running" || runningSince.current === null) return;
    const activeElapsed = elapsedBase.current + Math.floor(Math.max(0, Date.now() - runningSince.current) / 1000);
    const currentMode = modeRef.current;
    const config = configRef.current;
    const chapter = chapters.find((item) => item.id === config.chapterId);
    const focusSeconds = isBreakMode(currentMode) ? 0 : currentMode === "interval"
      ? Math.floor(activeElapsed / (config.intervalFocus + config.intervalBreak) / 60) * config.intervalFocus * 60 + Math.min(activeElapsed % ((config.intervalFocus + config.intervalBreak) * 60), config.intervalFocus * 60)
      : activeElapsed;
    if (!startedAt.current || saved.current) return;
    const record: FocusSession = { id: crypto.randomUUID(), mode: currentMode, subject: chapter?.subject ?? config.subject,
      chapter: chapter?.name ?? "", topic: config.topic.trim(), activity: isBreakMode(currentMode) ? "Revision" : config.activity,
      startedAt: startedAt.current, endedAt: new Date().toISOString(), focusedSeconds: Math.max(0, focusSeconds), status: "interrupted" };
    try {
      const raw = window.localStorage.getItem("shunya-focus-sessions-v1");
      const entries: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(entries)) window.localStorage.setItem("shunya-focus-sessions-v1", JSON.stringify([...entries, record]));
      saved.current = true;
    } catch { /* Do not overwrite malformed history on page exit. */ }
  }, [chapters]);
  useEffect(() => { window.addEventListener("pagehide", interruptOnLeave); return () => window.removeEventListener("pagehide", interruptOnLeave); }, [interruptOnLeave]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function selectMode(next: ToolMode) {
    if (status !== "idle") return notify("Pause and end the current timer before changing modes.");
    setMode(next); modeRef.current = next; setElapsed(0); elapsedBase.current = 0; saved.current = false; startedAt.current = null;
  }
  function start() {
    if (!ready) return;
    if (!isBreakMode(mode) && !chapterId) return notify("Choose a chapter before starting a study timer.");
    if (status === "paused") { runningSince.current = Date.now(); setStatus("running"); statusRef.current = "running"; setNow(Date.now()); return; }
    startedAt.current = new Date().toISOString(); saved.current = false; elapsedBase.current = 0; runningSince.current = Date.now(); setElapsed(0); setNow(Date.now()); setStatus("running"); statusRef.current = "running";
  }
  function pause() {
    if (status !== "running" || runningSince.current === null) return;
    elapsedBase.current += Math.floor(Math.max(0, Date.now() - runningSince.current) / 1000);
    runningSince.current = null; setElapsed(elapsedBase.current); setStatus("paused"); statusRef.current = "paused";
  }
  function endSession() {
    if (status === "idle") return;
    const seconds = status === "running" && runningSince.current !== null
      ? elapsedBase.current + Math.floor(Math.max(0, Date.now() - runningSince.current) / 1000) : elapsedBase.current;
    const focusSeconds = isBreakMode(mode) ? 0 : mode === "interval"
      ? Math.floor(seconds / (intervalFocus + intervalBreak) / 60) * intervalFocus * 60 + Math.min(seconds % ((intervalFocus + intervalBreak) * 60), intervalFocus * 60)
      : seconds;
    if (seconds > 0) void saveSession("interrupted", focusSeconds);
    elapsedBase.current = 0; runningSince.current = null; setElapsed(0); setStatus("idle"); statusRef.current = "idle";
    notify(seconds ? "Interrupted session saved. Pause and break time were excluded." : "Timer ended.");
  }
  function reset() {
    if (status !== "idle") { endSession(); return; }
    elapsedBase.current = 0; runningSince.current = null; startedAt.current = null; saved.current = false; setElapsed(0);
  }
  function setNumber(value: string, setter: (n: number) => void, min: number, max: number) {
    const parsed = Number(value); if (Number.isFinite(parsed)) setter(clamp(parsed, min, max));
  }
  const todaySessions = history.filter((session) => new Date(session.startedAt).toDateString() === new Date().toDateString());
  const sessionTotal = history.reduce((sum, item) => sum + item.focusedSeconds, 0);

  return <main className="focus-page">
    <header className="focus-topbar"><Link href="/focus" className="focus-back"><ArrowLeft size={15} /> Focus room</Link><div className="focus-brand"><span>श</span> SHUNYA <small>MORE TIMERS</small></div><Link href="/chapters" className="focus-chapters-link"><BookOpen size={13} /> Chapters</Link></header>
    <div className="focus-content-page">
      <div className="focus-intro"><div><div className="focus-kicker"><Sparkles size={12} /> PHASE 4 · FOCUS TOOLS</div><h1>Choose your rhythm.</h1><p>Stopwatch, countdown, breaks, study intervals, and revision—tracked with your focus history.</p></div><div className="focus-saved"><span /> Saved on this device</div></div>
      <div className="tool-mode-grid">{(Object.keys(modeLabels) as ToolMode[]).map((item) => <button key={item} className={`tool-mode ${mode === item ? "active" : ""}`} onClick={() => selectMode(item)}><span className="tool-mode-icon">{isBreakMode(item) ? <Coffee size={14} /> : item === "interval" ? <RotateCcw size={14} /> : <Clock3 size={14} />}</span><b>{modeLabels[item]}</b><small>{item === "stopwatch" ? "Count up freely" : item === "countdown" ? "A timed focus block" : item === "short-break" ? "A quick recharge" : item === "long-break" ? "Take a longer rest" : item === "interval" ? "Alternate focus and rest" : "Dedicated revision block"}</small></button>)}</div>
      <div className="tool-layout">
        <section className="card tool-timer-card"><div className="tool-timer-head"><div><span className={`timer-phase-pill ${intervalIsBreak || isBreakMode(mode) ? "break-pill" : ""}`}>{mode === "interval" ? intervalIsBreak ? <><Coffee size={12} /> BREAK INTERVAL</> : <><span className="live-dot" /> FOCUS INTERVAL</> : isBreakMode(mode) ? <><Coffee size={12} /> BREAK · NOT COUNTED AS FOCUS</> : <><span className="live-dot" /> {modeLabels[mode].toUpperCase()}</>}</span><h2>{status === "running" ? intervalIsBreak || isBreakMode(mode) ? "Rest and recharge." : "Stay in your rhythm." : status === "paused" ? "Timer paused." : "Ready when you are."}</h2></div><span className={`timer-state ${status}`}>{status === "running" ? "RUNNING" : status === "paused" ? "PAUSED" : "READY"}</span></div>
          <div className={`timer-dial ${status === "running" ? "is-running" : ""}`}><svg viewBox="0 0 260 260" aria-hidden="true"><circle className="dial-track" cx="130" cy="130" r="116"/><circle className="dial-progress" cx="130" cy="130" r="116" strokeDasharray={`${2 * Math.PI * 116}`} strokeDashoffset={`${2 * Math.PI * 116 * (1 - (progressTotal ? progressElapsed / progressTotal : 0))}`}/></svg><div className="timer-readout"><strong>{formatClock(mode === "stopwatch" ? liveElapsed : intervalIsBreak ? phaseRemaining : remaining)}</strong><span>{mode === "stopwatch" ? "ELAPSED" : intervalIsBreak ? "BREAK REMAINING" : "TIME REMAINING"}</span></div></div>
          {mode === "interval" && <div className="interval-status">Round {Math.min(rounds, Math.floor(liveElapsed / (intervalCycle || 1)) + 1)} of {rounds} · {intervalIsBreak ? "break time" : "focus time"}</div>}
          <div className="timer-controls">{status === "running" ? <button className="timer-primary" onClick={pause}><Pause size={15} fill="currentColor"/> Pause</button> : <button className="timer-primary" onClick={start} disabled={!ready || (!isBreakMode(mode) && !chapterId)}><Play size={15} fill="currentColor"/>{status === "paused" ? "Resume" : "Start"}</button>}{status !== "idle" && <button className="timer-secondary" onClick={endSession}><Square size={12} fill="currentColor"/> End & save</button>}<button className="timer-reset" aria-label="Reset timer" onClick={reset}><RotateCcw size={14}/></button></div>
          <div className="tool-config">{mode === "interval" ? <><label>Focus min<input type="number" min="1" max="180" value={intervalFocus} disabled={status !== "idle"} onChange={(event) => setNumber(event.target.value,setIntervalFocus,1,180)}/></label><label>Break min<input type="number" min="1" max="60" value={intervalBreak} disabled={status !== "idle"} onChange={(event) => setNumber(event.target.value,setIntervalBreak,1,60)}/></label><label>Rounds<input type="number" min="1" max="12" value={rounds} disabled={status !== "idle"} onChange={(event) => setNumber(event.target.value,setRounds,1,12)}/></label></> : mode === "short-break" || mode === "long-break" ? <label>Break minutes<input type="number" min="1" max="120" value={mode === "short-break" ? shortBreakMinutes : longBreakMinutes} disabled={status !== "idle"} onChange={(event) => mode === "short-break" ? setNumber(event.target.value,setShortBreakMinutes,1,120) : setNumber(event.target.value,setLongBreakMinutes,1,120)}/></label> : mode === "stopwatch" ? <span className="config-note">Stopwatch counts only while running.</span> : <label>{mode === "revision" ? "Revision duration" : "Countdown duration"} (minutes)<input type="number" min="1" max="240" value={minutes} disabled={status !== "idle"} onChange={(event) => setNumber(event.target.value,setMinutes,1,240)}/></label>}</div>
          <p className="tool-focus-note"><Clock3 size={12}/> Focus seconds: <strong>{displayDuration(focusedCurrent)}</strong>. Pauses and break intervals are excluded.</p>
        </section>
        <aside className="focus-side"><section className="card intention-card"><div className="side-card-heading"><div><span className="side-heading-icon"><BookOpen size={14}/></span><div><h2>Session intention</h2><p>Study session details</p></div></div></div><div className="intention-fields"><label>Subject<select value={subject} disabled={status !== "idle" || isBreakMode(mode)} onChange={(event) => {setSubject(event.target.value as StudySubject);setChapterId("");}}>{chapterSubjects.map((item)=><option key={item}>{item}</option>)}</select></label><label>Chapter<select value={chapterId} disabled={status !== "idle" || isBreakMode(mode) || !relevantChapters.length} onChange={(event)=>setChapterId(event.target.value)}><option value="">Select chapter</option>{relevantChapters.map((chapter)=><option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label><label>Topic <span>OPTIONAL</span><input value={topic} disabled={status !== "idle" || isBreakMode(mode)} maxLength={70} onChange={(event)=>setTopic(event.target.value)} placeholder="e.g. Electric potential"/></label><label>Activity<select value={activity} disabled={status !== "idle" || isBreakMode(mode)} onChange={(event)=>setActivity(event.target.value as FocusActivity)}>{activities.map((item)=><option key={item}>{item}</option>)}</select></label></div>{isBreakMode(mode) ? <div className="intention-confirm"><Coffee size={12}/> Break sessions are saved with zero focused study time.</div> : <div className="intention-confirm"><Check size={12}/>{selectedChapter?.name || "Choose a chapter"} · {activity}</div>}</section>
          <section className="card focus-history-card"><div className="side-card-heading"><div><span className="side-heading-icon"><Clock3 size={14}/></span><div><h2>Recent sessions</h2><p>{todaySessions.length} today · {displayDuration(sessionTotal)} total focus</p></div></div></div>{history.length ? <div className="history-list">{[...history].reverse().slice(0,6).map((session)=><article className="history-row" key={session.id}><span className={`history-status ${session.status}`}/><div><strong>{session.chapter || session.subject || modeLabels[session.mode as ToolMode] || session.mode}</strong><span>{session.subject} · {session.mode.replaceAll("-"," ")} · {session.status}</span></div><b>{displayDuration(session.focusedSeconds)}</b></article>)}</div> : <div className="history-empty">No saved sessions yet. Sessions will appear after completion or interruption.</div>}</section></aside>
      </div>
      {error && <div className="focus-error" role="alert">{error}</div>}
      <p className="focus-footnote"><Clock3 size={12}/> Timer state is measured from timestamps, not display ticks. Paused and break time do not count as study focus.</p>
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
