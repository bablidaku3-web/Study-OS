"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, BarChart3, BookOpen, Check, CircleAlert, ClipboardList, RotateCcw, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Chapter, chapterRepository, Zone } from "@/lib/data/chapterRepository";
import { MistakeRecord, mistakeRepository } from "@/lib/data/mistakeRepository";
import { RevisionSchedule, revisionRepository } from "@/lib/data/revisionRepository";
import { buildChapterPerformance, getSubjectPerformance, MIN_ZONE_ATTEMPTS, revisionImpact, suggestChapterZones } from "@/lib/data/performanceAnalysis";
import { StudyTest, TestAttempt, testRepository } from "@/lib/data/testRepository";
import styles from "./performance.module.css";

type Decision = { chapterId: string; action: "accepted" | "rejected" | "overridden"; zone: Zone | null; updatedAt: string };
const DECISIONS_KEY = "shunya-zone-suggestion-decisions-v1";
function readDecisions(): Decision[] {
  try { const raw = window.localStorage.getItem(DECISIONS_KEY); if (!raw) return []; const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter((item): item is Decision => !!item && typeof item === "object" && typeof (item as Decision).chapterId === "string" && ["accepted","rejected","overridden"].includes((item as Decision).action)) : []; }
  catch { throw new Error("Saved zone decisions could not be read; existing data was not changed."); }
}
function formatPercent(value: number | null) { return value === null ? "—" : `${value}%`; }

export default function PerformancePage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [revisions, setRevisions] = useState<RevisionSchedule[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [exam, setExam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([chapterRepository.list(), testRepository.listTests(), testRepository.listAttempts(), mistakeRepository.list(), revisionRepository.list()])
      .then(([c, t, a, m, r]) => { setChapters(c); setTests(t); setAttempts(a); setMistakes(m); setRevisions(r); setDecisions(readDecisions()); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to read saved performance data."))
      .finally(() => setLoading(false));
  }, []);

  const submitted = useMemo(() => {
    const testMap = new Map(tests.map((test) => [test.id, test]));
    return attempts.filter((attempt) => !!attempt.submittedAt && !!attempt.result && !!testMap.get(attempt.testId) && (!exam || testMap.get(attempt.testId)?.exam === exam));
  }, [attempts, tests, exam]);
  const filteredTests = useMemo(() => exam ? tests.filter((test) => test.exam === exam) : tests, [tests, exam]);
  const filteredAttempts = useMemo(() => exam ? submitted : attempts, [exam, submitted, attempts]);
  const chapterPerformance = useMemo(() => buildChapterPerformance(filteredTests, filteredAttempts), [filteredTests, filteredAttempts]);
  const subjectPerformance = useMemo(() => getSubjectPerformance(filteredTests, filteredAttempts), [filteredTests, filteredAttempts]);
  const suggestions = useMemo(() => suggestChapterZones(chapters, filteredTests, filteredAttempts, mistakes), [chapters, filteredTests, filteredAttempts, mistakes]);
  const impacts = useMemo(() => revisionImpact(revisions, filteredTests, filteredAttempts), [revisions, filteredTests, filteredAttempts]);
  const testMap = new Map(tests.map((test) => [test.id, test]));
  const validAttempts = submitted.sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
  const totalAnswered = chapterPerformance.reduce((sum, item) => sum + item.attempted, 0);
  const accuracy = totalAnswered ? Math.round(chapterPerformance.reduce((sum, item) => sum + item.correct, 0) / totalAnswered * 100) : null;
  const recentScores = validAttempts.slice(-8);
  const repeatedMistakes = useMemo(() => {
    const groups = new Map<string, { subject: string; chapter: string; count: number; categories: Map<string, number> }>();
    mistakes.filter((item) => item.status !== "Resolved" && (!exam || item.exam === (exam === "NEET UG" ? "NEET" : exam.startsWith("JEE") ? "JEE" : exam))).forEach((item) => {
      const key = `${item.subject}\u0000${item.chapter}`; const group = groups.get(key) || { subject: item.subject, chapter: item.chapter, count: 0, categories: new Map<string, number>() };
      group.count++; group.categories.set(item.category, (group.categories.get(item.category) || 0) + 1); groups.set(key, group);
    });
    return [...groups.values()].filter((item) => item.count >= 2).sort((a, b) => b.count - a.count);
  }, [mistakes, exam]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function saveDecision(decision: Decision) {
    const next = [...decisions.filter((item) => item.chapterId !== decision.chapterId), decision];
    try { window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(next)); setDecisions(next); setError(""); }
    catch { setError("Could not save your zone decision."); }
  }
  async function acceptSuggestion(suggestion: typeof suggestions[number]) {
    const chapter = chapters.find((item) => item.id === suggestion.chapterId);
    if (!chapter) return;
    if (chapter.zone !== null) return setError("This chapter already has a zone. Use Manual override only if you intend to change it.");
    const next = chapters.map((item) => item.id === chapter.id ? { ...item, zone: suggestion.zone, updatedAt: new Date().toISOString() } : item);
    try { await chapterRepository.save(next); setChapters(next); saveDecision({ chapterId: chapter.id, action: "accepted", zone: suggestion.zone, updatedAt: new Date().toISOString() }); notify(`${chapter.name} assigned ${suggestion.zone} zone based on test evidence.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save zone."); }
  }
  function rejectSuggestion(suggestion: typeof suggestions[number]) { saveDecision({ chapterId: suggestion.chapterId, action: "rejected", zone: null, updatedAt: new Date().toISOString() }); }
  async function manualOverride(chapterId: string, zone: string) {
    const chapter = chapters.find((item) => item.id === chapterId); if (!chapter) return;
    const selected = zone === "unassessed" ? null : zone as Zone;
    const next = chapters.map((item) => item.id === chapterId ? { ...item, zone: selected, updatedAt: selected ? new Date().toISOString() : null } : item);
    try { await chapterRepository.save(next); setChapters(next); saveDecision({ chapterId, action: "overridden", zone: selected, updatedAt: new Date().toISOString() }); notify("Manual chapter zone saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update chapter zone."); }
  }
  const zoneLabel = (zone: Zone) => zone[0].toUpperCase() + zone.slice(1);
  const decisionLabel = (id: string) => decisions.find((item) => item.chapterId === id);

  return <main className={styles.page}><header className={styles.topbar}><Link href="/" className={styles.back}><ArrowLeft size={15}/> Dashboard</Link><div className={styles.brand}><span>श</span> SHUNYA <small>PERFORMANCE</small></div><Link href="/tests" className={styles.navLink}>Mock tests <ArrowUpRight size={13}/></Link></header><div className={styles.content}>
    <div className={styles.hero}><div><div className={styles.kicker}><Activity size={12}/> RESULTS FROM YOUR SUBMITTED TESTS</div><h1>Performance, with evidence.</h1><p>No study-time-based mastery claims. Recommendations use submitted mock answers and recorded Mistake Vault entries.</p></div><label className={styles.examFilter}>Exam<select value={exam} onChange={(event)=>setExam(event.target.value)}><option value="">All exams</option>{[...new Set(tests.map((test)=>test.exam))].map((item)=><option key={item}>{item}</option>)}</select></label></div>
    <section className={styles.stats}><article><ClipboardList size={15}/><b>{validAttempts.length}</b><span>Submitted tests</span></article><article><BookOpen size={15}/><b>{totalAnswered}</b><span>Answered questions</span></article><article><BarChart3 size={15}/><b>{formatPercent(accuracy)}</b><span>Overall accuracy</span></article><article><CircleAlert size={15}/><b>{mistakes.length}</b><span>Saved mistakes</span></article></section>
    {error&&<div className={styles.error} role="alert">{error}</div>}{loading&&<div className={styles.empty}>Loading actual test and mistake data…</div>}
    <section className={styles.columns}><article className={styles.panel}><div className={styles.heading}><div><h2>Subject performance</h2><p>Answered-question accuracy; only submitted test attempts.</p></div></div>{subjectPerformance.length?<div className={styles.performanceList}>{subjectPerformance.map((item)=><div key={item.subject}><span>{item.subject}</span><div className={styles.track}><i style={{width:`${item.accuracy}%`}}/></div><b>{item.accuracy}%</b><small>{item.correct}/{item.attempted} correct · {item.testCount} tests</small></div>)}</div>:<div className={styles.empty}>No submitted question-level test data for this scope.</div>}</article>
      <article className={styles.panel}><div className={styles.heading}><div><h2>Mock test score trend</h2><p>Actual marks from submitted attempts, sorted by submission date.</p></div></div>{recentScores.length?<div className={styles.scoreTrend}>{recentScores.map((attempt,index)=>{const test=testMap.get(attempt.testId)!;const result=attempt.result!;const percent=result.totalMarks>0?Math.max(0,result.marksObtained/result.totalMarks*100):0;return <div key={attempt.id} title={`${test.title}: ${result.marksObtained}/${result.totalMarks}`}><i style={{height:`${Math.max(4,Math.min(100,percent))}%`}}/><span>{index+1}</span><small>{test.title}</small></div>;})}</div>:<div className={styles.empty}>Score trends appear after submitted tests with results.</div>}</article></section>
    <section className={styles.panel}><div className={styles.heading}><div><h2>Chapter performance</h2><p>Minimum {MIN_ZONE_ATTEMPTS} answered questions recommended before zone suggestions.</p></div><span>{chapterPerformance.length} chapters with attempts</span></div>{chapterPerformance.length?<div className={styles.chapterTable}><div className={styles.tableHead}><span>Chapter</span><span>Answered</span><span>Accuracy</span><span>Tests</span><span>Recent change</span></div>{chapterPerformance.map((item)=><div className={styles.tableRow} key={`${item.subject}-${item.chapter}`}><span><b>{item.chapter||"Unspecified chapter"}</b><small>{item.subject}</small></span><span>{item.attempted}</span><span>{item.accuracy}%</span><span>{item.testCount}</span><span>{item.recentAccuracy===null||item.previousAccuracy===null?"Need more test data":`${item.recentAccuracy-item.previousAccuracy>=0?"+":""}${item.recentAccuracy-item.previousAccuracy} pp`}</span></div>)}</div>:<div className={styles.empty}>Chapter accuracy needs submitted tests containing answered questions.</div>}</section>
    <section className={styles.panel}><div className={styles.heading}><div><h2>Automatic zone suggestions</h2><p>Only submitted answer accuracy and repeated unresolved mistakes are used. Existing zones are never silently changed.</p></div><ShieldAlert size={15}/></div>{suggestions.length?<div className={styles.suggestionList}>{suggestions.map((suggestion)=><article key={suggestion.chapterId}><div className={styles.suggestionHead}><span className={`${styles.zone} ${styles[suggestion.zone]}`}>{zoneLabel(suggestion.zone)} suggestion</span><b>{suggestion.subject} · {suggestion.chapter}</b><small>{suggestion.answered} answered · {suggestion.accuracy}% accuracy · {suggestion.mistakeCount} unresolved vault entries</small></div><p>{suggestion.reason}</p><div className={styles.suggestionActions}>{chapters.find((item)=>item.id===suggestion.chapterId)?.zone===null?<><button className={styles.accept} onClick={()=>void acceptSuggestion(suggestion)}><Check size={12}/> Accept</button><button className={styles.reject} onClick={()=>rejectSuggestion(suggestion)}>Reject</button></>:<span className={styles.protected}>Current zone: {chapters.find((item)=>item.id===suggestion.chapterId)?.zone} · use manual override below</span>}</div><label className={styles.override}>Manual override<select value={chapters.find((item)=>item.id===suggestion.chapterId)?.zone||"unassessed"} onChange={(event)=>void manualOverride(suggestion.chapterId,event.target.value)}><option value="unassessed">Unassessed</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option></select></label>{decisionLabel(suggestion.chapterId)&&<small className={styles.decision}>Last choice: {decisionLabel(suggestion.chapterId)?.action}</small>}</article>)}</div>:<div className={styles.empty}>No zone recommendations yet. Submit tests with at least {MIN_ZONE_ATTEMPTS} answered questions per chapter, or record three unresolved mistakes for a chapter. Existing manual zones remain unchanged.</div>}</section>
    <section className={styles.columns}><article className={styles.panel}><div className={styles.heading}><div><h2>Repeated Mistake Vault categories</h2><p>Unresolved records grouped by subject and chapter.</p></div><Link href="/mistakes">Open Vault <ArrowUpRight size={12}/></Link></div>{repeatedMistakes.length?<div className={styles.mistakeGroups}>{repeatedMistakes.map((item)=><div key={`${item.subject}-${item.chapter}`}><b>{item.chapter||"Chapter unspecified"}</b><span>{item.subject} · {item.count} unresolved mistakes</span><small>{[...item.categories.entries()].map(([category,count])=>`${category}: ${count}`).join(" · ")}</small><Link href="/revision">Review revision plans <ArrowUpRight size={11}/></Link></div>)}</div>:<div className={styles.empty}>Repeated categories appear when actual unresolved Mistake Vault records exist.</div>}</article>
      <article className={styles.panel}><div className={styles.heading}><div><h2>Revision and performance</h2><p>Before/after comparison requires enough answered test questions on both sides.</p></div><RotateCcw size={15}/></div>{impacts.length? <div className={styles.impactList}>{impacts.map((item)=><div key={item.scheduleId}><b>{item.chapter}</b><span>{item.subject} · {item.beforeCount} pre / {item.afterCount} post questions</span><p>{item.message}</p></div>)}</div>:<div className={styles.empty}>No completed revision with matching chapter-level test data yet.</div>}</article></section>
    <p className={styles.disclaimer}><CircleAlert size={12}/> Zone thresholds: minimum 5 answered questions. Green requires ≥80% overall and recent performance, red suggests ≤45%, 3 unresolved mistakes, or recent accuracy below 40%; other sufficient mixed evidence suggests yellow. These are review suggestions, not mastery diagnoses. Revision comparisons are observational and require 5 questions before and after.</p>
  </div></main>;
}
