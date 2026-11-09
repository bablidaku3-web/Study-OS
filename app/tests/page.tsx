"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Plus, Trash2 } from "lucide-react";
import { chapterRepository, chapterSubjects, Chapter } from "@/lib/data/chapterRepository";
import { ExamType, QuestionType, StudyTest, TestQuestion, testRepository } from "@/lib/data/testRepository";
import styles from "./tests.module.css";

const examTypes: ExamType[] = ["JEE Main", "JEE Advanced", "NEET UG"];
const questionTypes: QuestionType[] = ["MCQ", "Multiple Correct", "Numerical"];
const emptyQuestion = () => ({ subject: "Physics", chapter: "", topic: "", type: "MCQ" as QuestionType, prompt: "", options: ["", "", "", ""], answer: "", positive: "4", negative: "1", explanation: "" });

export default function TestsPage() {
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [exam, setExam] = useState<ExamType>("JEE Main");
  const [duration, setDuration] = useState(60);
  const [question, setQuestion] = useState(emptyQuestion());
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => { Promise.all([testRepository.listTests(), chapterRepository.list()]).then(([savedTests, savedChapters]) => { setTests(savedTests); setChapters(savedChapters); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load tests.")).finally(() => setLoading(false)); }, []);
  const subjects = exam === "NEET UG" ? ["Physics", "Chemistry", "Biology"] : ["Physics", "Chemistry", "Mathematics"];
  const chapterOptions = chapters.filter((item) => item.subject === question.subject);

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.prompt.trim();
    if (!prompt || !question.chapter) return setError("Question text and chapter are required.");
    const positive = Number(question.positive); const negative = Number(question.negative);
    if (!Number.isFinite(positive) || positive <= 0 || !Number.isFinite(negative) || negative < 0) return setError("Marks must be valid numbers (positive marks > 0; negative marks ≥ 0).");
    let answer: string | string[];
    if (question.type === "Numerical") {
      if (!question.answer.trim() || !Number.isFinite(Number(question.answer))) return setError("Enter a valid numerical correct answer.");
      answer = question.answer.trim();
    } else {
      const validOptions = question.options.map((option) => option.trim());
      if (validOptions.some((option) => !option)) return setError("Fill in all four answer options.");
      const indexes = question.answer.split(",").map((part) => part.trim()).filter(Boolean);
      if (!indexes.length || indexes.some((index) => !["1", "2", "3", "4"].includes(index))) return setError("Select the correct option number(s), comma-separated for multiple correct.");
      if (question.type === "MCQ" && indexes.length !== 1) return setError("MCQ must have exactly one correct option.");
      answer = indexes.map((index) => validOptions[Number(index) - 1]).sort();
      if (question.type === "MCQ") answer = answer[0];
    }
    const item: TestQuestion = { id: crypto.randomUUID(), subject: question.subject, chapter: question.chapter, topic: question.topic.trim(), type: question.type, prompt, options: question.type === "Numerical" ? [] : question.options.map((value) => value.trim()), correctAnswer: answer, positiveMarks: positive, negativeMarks: negative, explanation: question.explanation.trim() };
    setQuestions((current) => [...current, item]); setQuestion(emptyQuestion()); setError("");
  }
  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || questions.length === 0) return setError("Add a test title and at least one question.");
    if (duration < 1 || duration > 600) return setError("Test duration must be from 1 to 600 minutes.");
    const selectedSubjects = [...new Set(questions.map((item) => item.subject))];
    const test: StudyTest = { id: crypto.randomUUID(), title: cleanTitle, exam, subjects: selectedSubjects, durationMinutes: duration, totalMarks: questions.reduce((sum, item) => sum + item.positiveMarks, 0), createdAt: new Date().toISOString(), questions };
    try { await testRepository.createTest(test); setTests((items) => [test, ...items]); setTitle(""); setQuestions([]); setShowCreate(false); setError(""); setToast("Test saved. Your questions are ready."); window.setTimeout(() => setToast(""), 2400); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your test."); }
  }
  return <main className={styles.page}><header className={styles.topbar}><Link href="/" className={styles.back}><ArrowLeft size={15}/> Dashboard</Link><div className={styles.brand}><span>श</span> SHUNYA <small>TEST CENTER</small></div><Link href="/focus/analytics" className={styles.analyticsLink}>Focus analytics <ArrowRight size={13}/></Link></header><div className={styles.content}>
    <div className={styles.hero}><div><div className={styles.kicker}>PREPARATION · MOCK TESTS</div><h1>Test center</h1><p>Create a focused practice test or review your saved results.</p></div><button className={styles.primary} onClick={() => setShowCreate((open) => !open)}><Plus size={14}/> Create a test</button></div>
    {showCreate && <section className={styles.createCard}><div className={styles.sectionTitle}><div><h2>Build a custom test</h2><p>Add questions with subject-specific marking.</p></div><span>{questions.length} question{questions.length === 1 ? "" : "s"}</span></div><form onSubmit={createTest} className={styles.testForm}><label>Test title<input value={title} onChange={(event)=>setTitle(event.target.value)} maxLength={100} required placeholder="e.g. Mechanics revision test"/></label><label>Exam type<select value={exam} onChange={(event)=>setExam(event.target.value as ExamType)}>{examTypes.map((item)=><option key={item}>{item}</option>)}</select></label><label>Duration (minutes)<input type="number" min="1" max="600" value={duration} onChange={(event)=>setDuration(Number(event.target.value))}/></label></form>
      <form className={styles.questionForm} onSubmit={addQuestion}><h3><BookOpen size={14}/> Add question</h3><div className={styles.formGrid}><label>Subject<select value={question.subject} onChange={(event)=>setQuestion({...question,subject:event.target.value,chapter:""})}>{subjects.map((item)=><option key={item}>{item}</option>)}</select></label><label>Chapter<select value={question.chapter} onChange={(event)=>setQuestion({...question,chapter:event.target.value})}><option value="">Choose chapter</option>{chapterOptions.map((item)=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Topic (optional)<input maxLength={80} value={question.topic} onChange={(event)=>setQuestion({...question,topic:event.target.value})}/></label><label>Question type<select value={question.type} onChange={(event)=>setQuestion({...question,type:event.target.value as QuestionType,answer:""})}>{questionTypes.map((item)=><option key={item}>{item}</option>)}</select></label></div><label>Question prompt<textarea rows={3} maxLength={2000} value={question.prompt} onChange={(event)=>setQuestion({...question,prompt:event.target.value})} required placeholder="Type the question…"/></label>
        {question.type !== "Numerical" && <div className={styles.optionsGrid}>{question.options.map((option,index)=><label key={index}>Option {index+1}<input value={option} maxLength={300} onChange={(event)=>setQuestion({...question,options:question.options.map((value,i)=>i===index?event.target.value:value)})}/></label>)}</div>}
        <div className={styles.formGrid}><label>{question.type === "Numerical" ? "Correct numerical answer" : question.type === "MCQ" ? "Correct option number (1–4)" : "Correct option numbers (e.g. 1,3)"}<input value={question.answer} onChange={(event)=>setQuestion({...question,answer:event.target.value})} required/></label><label>Positive marks<input type="number" min="0.01" step="0.25" value={question.positive} onChange={(event)=>setQuestion({...question,positive:event.target.value})}/></label><label>Negative marks<input type="number" min="0" step="0.25" value={question.negative} onChange={(event)=>setQuestion({...question,negative:event.target.value})}/></label><label>Explanation (optional)<input value={question.explanation} maxLength={800} onChange={(event)=>setQuestion({...question,explanation:event.target.value})}/></label></div><button className={styles.secondary} type="submit"><Plus size={13}/> Add question to test</button></form>
      {questions.length > 0 && <div className={styles.questionDrafts}>{questions.map((item,index)=><div key={item.id}><span>Q{index+1} · {item.subject} · {item.chapter}</span><button aria-label={`Remove question ${index+1}`} onClick={()=>setQuestions((list)=>list.filter((question)=>question.id!==item.id))}><Trash2 size={13}/></button></div>)}</div>}<form onSubmit={createTest}><button className={styles.primary} type="submit"><CheckCircle2 size={14}/> Save test ({questions.length})</button></form></section>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    <section className={styles.testList}><div className={styles.sectionTitle}><div><h2>Your tests</h2><p>Saved on this device · results are calculated from submitted answers.</p></div><span>{tests.length} total</span></div>{loading ? <div className={styles.empty}>Loading tests…</div> : tests.length ? <div className={styles.testGrid}>{tests.map((test)=><article className={styles.testCard} key={test.id}><div className={styles.examTag}>{test.exam}</div><h3>{test.title}</h3><p>{test.subjects.join(" · ")}</p><div className={styles.testMeta}><span><BookOpen size={12}/>{test.questions.length} questions</span><span><Clock3 size={12}/>{test.durationMinutes} min</span><span>{test.totalMarks} marks</span></div><Link href={`/tests/${test.id}`} className={styles.primary}>{test.questions.length ? "Open test" : "No questions"}<ArrowRight size={13}/></Link></article>)}</div> : <div className={styles.empty}><BookOpen size={20}/><b>No tests created yet</b><span>Create your first custom test. Results will be based only on your submitted answers.</span></div>}</section>
  </div>{toast && <div className="toast" role="status">{toast}</div>}</main>;
}
