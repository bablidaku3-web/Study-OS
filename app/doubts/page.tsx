"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, Clock3, ImagePlus, LoaderCircle, Plus, RotateCcw, Send, Sparkles, Trash2 } from "lucide-react";
import { Chapter, chapterRepository } from "@/lib/data/chapterRepository";
import { DoubtMode, DoubtRecord, doubtRepository } from "@/lib/data/doubtRepository";
import { ExamCategory, MistakeRecord, mistakeRepository } from "@/lib/data/mistakeRepository";
import { ExamType } from "@/lib/data/testRepository";
import { DEFAULT_REVISION_INTERVALS, RevisionSchedule, revisionRepository } from "@/lib/data/revisionRepository";
import styles from "./doubts.module.css";

const exams: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];
const modes: DoubtMode[] = ["Explain Simply", "Step-by-Step Solution", "Concept Explanation", "Shortcut Method", "Similar Practice Questions"];
type UploadImage = { name: string; mimeType: string; dataUrl: string };
type ApiResult = { answer?: string; model?: string; error?: string };

function getJeeExam(tests: ExamType[]): ExamType { return tests[0] || "JEE Main"; }

export default function DoubtsPage() {
  const [exam, setExam] = useState<ExamCategory>("JEE");
  const [subject, setSubject] = useState("Physics");
  const [chapterId, setChapterId] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<DoubtMode>("Step-by-Step Solution");
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<UploadImage | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [history, setHistory] = useState<DoubtRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [solving, setSolving] = useState(false);
  const [savingMistakeId, setSavingMistakeId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [answerModel, setAnswerModel] = useState("");
  const [activeRecord, setActiveRecord] = useState<DoubtRecord | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const relevantChapters = useMemo(() => chapters.filter((chapter) => chapter.subject === subject), [chapters, subject]);

  useEffect(() => {
    Promise.all([chapterRepository.list(), doubtRepository.list(), mistakeRepository.list()])
      .then(([savedChapters, savedHistory, savedMistakes]) => { setChapters(savedChapters); setHistory([...savedHistory].reverse()); setMistakes(savedMistakes); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load doubt solver data."))
      .finally(() => setLoadingHistory(false));
  }, []);
  useEffect(() => { if (relevantChapters.length && !relevantChapters.some((chapter) => chapter.id === chapterId)) setChapterId(relevantChapters[0].id); }, [relevantChapters, chapterId]);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Choose a JPEG, PNG, or WebP image.");
    if (file.size > 2.5 * 1024 * 1024) return setError("Image must be 2.5 MB or smaller.");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read the selected image.")); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unsupported image data.")); reader.readAsDataURL(file);
      });
      setImage({ name: file.name.slice(0, 160), mimeType: file.type, dataUrl }); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read image."); }
  }
  async function solve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() && !image) return setError("Enter a question or attach an image.");
    if (!subject.trim()) return setError("Choose a subject.");
    setSolving(true); setError(""); setAnswer(""); setAnswerModel(""); setActiveRecord(null);
    try {
      const chapter = chapters.find((item) => item.id === chapterId);
      const response = await fetch("/api/doubt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam, subject, chapter: chapter?.name || "", topic, mode, question, image: image ? { name: image.name, mimeType: image.mimeType, dataUrl: image.dataUrl } : null }) });
      const data = await response.json() as ApiResult;
      if (!response.ok) throw new Error(data.error || "Doubt solver request failed.");
      if (!data.answer || !data.model) throw new Error("AI provider returned an incomplete response.");
      const record: DoubtRecord = { id: crypto.randomUUID(), exam, subject, chapter: chapter?.name || "", topic: topic.trim(), mode, question: question.trim() || `Question from image: ${image?.name || "uploaded image"}`, answer: data.answer, model: data.model, createdAt: new Date().toISOString(), imageName: image?.name || null };
      await doubtRepository.add(record); setHistory((items) => [record, ...items]); setAnswer(record.answer); setAnswerModel(record.model); setActiveRecord(record);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not solve question. No AI response was generated."); }
    finally { setSolving(false); }
  }
  function restore(record: DoubtRecord) { setExam(record.exam); setSubject(record.subject); setTopic(record.topic); setQuestion(record.question); setMode(record.mode); setAnswer(record.answer); setAnswerModel(record.model); setActiveRecord(record); setError(""); }
  async function convertMistake(record: DoubtRecord) {
    if (mistakes.some((item) => item.source === "manual" && item.question === record.question && item.chapter === record.chapter && item.subject === record.subject)) return notify("A matching manual Mistake Vault entry already exists.");
    setSavingMistakeId(record.id);
    const now = new Date().toISOString();
    const mistake: MistakeRecord = { id: crypto.randomUUID(), exam: record.exam, subject: record.subject, chapter: record.chapter || "Unspecified", topic: record.topic,
      category: "Conceptual", status: "Needs Review", question: record.question, studentAnswer: "", explanation: "Added from Doubt Solver; categorize/clarify the original error before relying on this entry.", correctApproach: record.answer,
      source: "manual", testId: null, attemptId: null, questionId: null, testTitle: null, createdAt: now, updatedAt: now };
    try { await mistakeRepository.add(mistake); setMistakes((items) => [...items, mistake]); notify("Saved to Mistake Vault. Review the default category and explanation."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create Mistake Vault entry."); }
    finally { setSavingMistakeId(null); }
  }
  async function addRevision(record: DoubtRecord) {
    if (!record.chapter) return setError("Select a linked chapter before creating a revision schedule.");
    const matchingChapter = chapters.find((item) => item.name.toLowerCase() === record.chapter.toLowerCase() && item.subject === record.subject);
    const zone = matchingChapter?.zone;
    const schedule: RevisionSchedule = { id: crypto.randomUUID(), exam: record.exam, subject: record.subject, chapter: record.chapter, topic: record.topic,
      intervals: DEFAULT_REVISION_INTERVALS, completedCount: 0, nextDueDate: new Date().toLocaleDateString("en-CA"), status: "active", linkedMistakeIds: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), history: [] };
    try { await revisionRepository.add(schedule); notify(`Revision schedule added${zone ? ` · current zone: ${zone}` : ""}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create revision schedule."); }
  }
  async function removeDoubt(record: DoubtRecord) {
    try { await doubtRepository.remove(record.id); setHistory((items) => items.filter((item) => item.id !== record.id)); if (activeRecord?.id === record.id) { setActiveRecord(null); setAnswer(""); setAnswerModel(""); } notify("Doubt removed from history."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove doubt."); }
  }

  const subjectOptions = exam === "NEET" ? ["Physics", "Chemistry", "Biology"] : exam === "JEE" ? ["Physics", "Chemistry", "Mathematics"] : exam === "CA" ? ["Accounting", "Auditing", "Taxation", "Law", "Economics"] : ["History", "Geography", "Polity", "Economy", "Environment", "Science & Technology"];

  return <main className={styles.page}><header className={styles.topbar}><Link href="/" className={styles.back}><ArrowLeft size={15}/> Dashboard</Link><div className={styles.brand}><span>श</span> SHUNYA <small>DOUBT SOLVER</small></div><Link href="/mistakes" className={styles.navLink}>Mistake Vault</Link></header><div className={styles.content}>
    <div className={styles.hero}><div><div className={styles.kicker}><Sparkles size={12}/> SECURE SERVER-SIDE ACADEMIC TUTOR</div><h1>Let’s work through it.</h1><p>Ask a real question, choose how you want to learn, and get an explanation matched to your exam.</p></div><span className={styles.providerBadge}><i/> Server API · key not exposed</span></div>
    <div className={styles.layout}><section className={styles.solver}>
      <form onSubmit={solve} className={styles.form}><div className={styles.formGrid}><label>Exam<select value={exam} onChange={(event)=>{const value=event.target.value as ExamCategory;setExam(value);setSubject(value==="NEET"?"Physics":value==="JEE"?"Physics":value==="CA"?"Accounting":"History");setChapterId("");}}>{exams.map((item)=><option key={item}>{item}</option>)}</select></label><label>Subject<select value={subject} onChange={(event)=>{setSubject(event.target.value);setChapterId("");}}>{subjectOptions.map((item)=><option key={item}>{item}</option>)}</select></label><label>Chapter <span>OPTIONAL</span><select value={chapterId} onChange={(event)=>setChapterId(event.target.value)}><option value="">No linked chapter</option>{relevantChapters.map((chapter)=><option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label><label>Topic <span>OPTIONAL</span><input value={topic} onChange={(event)=>setTopic(event.target.value)} maxLength={100} placeholder="e.g. Gauss's law"/></label></div>
      <div className={styles.modePicker}><span>Learning mode</span><div>{modes.map((item)=><button type="button" key={item} className={mode===item?styles.modeActive:""} onClick={()=>setMode(item)}>{item}</button>)}</div></div>
      <label className={styles.questionLabel}>Your question<textarea value={question} onChange={(event)=>setQuestion(event.target.value)} maxLength={10000} rows={6} placeholder="Type equations, scientific notation (e.g. 6.02 × 10²³), or describe what you’re stuck on…"/><small>Equations in LaTeX text are supported, e.g. \(x^2 + y^2 = r^2\).</small></label>
      <div className={styles.uploadRow}><label className={styles.upload}><ImagePlus size={14}/> Add question image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>void chooseImage(event)}/></label>{image&&<div className={styles.imageChip}><span>{image.name}</span><button type="button" aria-label="Remove image" onClick={()=>setImage(null)}>×</button></div>}<span>JPEG, PNG, WebP · max 2.5 MB</span></div>
      <div className={styles.formFooter}><span>Answers are generated by the configured server AI provider; they are not available in demo mode.</span><button className={styles.primary} type="submit" disabled={solving}>{solving?<><LoaderCircle size={14} className={styles.spin}/> Solving…</>:<><Send size={13}/> Solve doubt</>}</button></div></form>
      {error&&<div className={styles.error} role="alert">{error}</div>}
      {solving&&<div className={styles.loading}><LoaderCircle size={17} className={styles.spin}/> Sending securely to the configured AI tutor…</div>}
      {answer&&<article className={styles.answerCard}><div className={styles.answerHead}><div><span><Check size={12}/> Provider answer · {answerModel}</span><h2>{activeRecord?.mode || mode}</h2></div>{activeRecord&&<time>{new Date(activeRecord.createdAt).toLocaleString()}</time>}</div><div className={styles.answerBody}>{answer}</div>{activeRecord&&<div className={styles.integrations}><button onClick={()=>void convertMistake(activeRecord)} disabled={savingMistakeId===activeRecord.id}><BookOpen size={13}/>{savingMistakeId===activeRecord.id?"Saving…":"Convert to Mistake Vault"}</button><button onClick={()=>void addRevision(activeRecord)}><RotateCcw size={13}/> Add chapter to Revision</button></div>}</article>}
    </section><aside className={styles.history}><div className={styles.historyHead}><div><h2><Clock3 size={14}/> Doubt history</h2><p>Only successfully answered, saved questions.</p></div><span>{history.length}</span></div>{loadingHistory?<div className={styles.historyEmpty}>Loading saved history…</div>:history.length?history.map((record)=><article key={record.id} className={`${styles.historyItem} ${activeRecord?.id===record.id?styles.historySelected:""}`}><button className={styles.historyMain} onClick={()=>restore(record)}><span>{record.exam} · {record.subject} · {record.mode}</span><b>{record.topic||record.chapter||"Question"}</b><small>{record.question}</small><time>{new Date(record.createdAt).toLocaleDateString()}</time></button><button className={styles.delete} aria-label="Delete saved doubt" onClick={()=>void removeDoubt(record)}><Trash2 size={12}/></button></article>):<div className={styles.historyEmpty}><BookOpen size={18}/><b>No saved doubts yet</b><span>Successful AI answers will be saved here.</span></div>}</aside></div>
    <p className={styles.privacy}><Sparkles size={12}/> API keys remain on the server. Uploaded images are sent to the configured provider for this request and are not stored in Doubt History.</p>
  </div>{toast&&<div className="toast" role="status">{toast}</div>}</main>;
}
