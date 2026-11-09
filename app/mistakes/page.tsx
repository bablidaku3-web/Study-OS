"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, CircleAlert, ClipboardList, Pencil, Plus, Search, Sparkles, X } from "lucide-react";
import { chapterRepository, chapterSubjects, Chapter } from "@/lib/data/chapterRepository";
import { MistakeCategory, MistakeRecord, MistakeStatus, ExamCategory, mistakeRepository } from "@/lib/data/mistakeRepository";
import { StudyTest, TestAttempt, TestQuestion, testRepository } from "@/lib/data/testRepository";
import styles from "./mistakes.module.css";

type Draft = { exam: ExamCategory; subject: string; chapter: string; topic: string; category: MistakeCategory; question: string; studentAnswer: string; explanation: string; correctApproach: string; testId: string; attemptId: string; questionId: string };
const categories: MistakeCategory[] = ["Conceptual", "Calculation", "Silly Mistake", "Time Management", "Memory/Recall"];
const statuses: MistakeStatus[] = ["Needs Review", "Revised", "Resolved"];
const exams: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];
const emptyDraft = (): Draft => ({ exam: "JEE", subject: "Physics", chapter: "", topic: "", category: "Conceptual", question: "", studentAnswer: "", explanation: "", correctApproach: "", testId: "", attemptId: "", questionId: "" });
function answerText(value: string | string[] | undefined) { return value === undefined || value === "" ? "" : Array.isArray(value) ? value.join(", ") : value; }

export default function MistakeVaultPage() {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [tests, setTests] = useState<StudyTest[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterExam, setFilterExam] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    Promise.all([mistakeRepository.list(), chapterRepository.list(), testRepository.listTests(), testRepository.listAttempts()])
      .then(([savedMistakes, savedChapters, savedTests, savedAttempts]) => { setMistakes(savedMistakes); setChapters(savedChapters); setTests(savedTests); setAttempts(savedAttempts); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load Mistake Vault data."))
      .finally(() => setLoading(false));
  }, []);

  const linkedAttempts = useMemo(() => attempts.filter((attempt) => attempt.submittedAt && attempt.result).flatMap((attempt) => {
    const test = tests.find((item) => item.id === attempt.testId);
    if (!test) return [];
    return test.questions.flatMap((question) => {
      const response = attempt.answers[question.id]?.value;
      const answered = response !== undefined && response !== "" && !(Array.isArray(response) && response.length === 0);
      if (!answered) return [];
      const expected = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String).sort();
      const given = (Array.isArray(response) ? response : [response]).map(String).sort();
      const correct = question.type === "Numerical" ? Number(response) === Number(question.correctAnswer) : expected.length === given.length && expected.every((value, index) => value === given[index]);
      if (correct || mistakes.some((item) => item.attemptId === attempt.id && item.questionId === question.id)) return [];
      return [{ attempt, test, question, response }];
    });
  }), [attempts, tests, mistakes]);

  const filtered = useMemo(() => mistakes.filter((item) => {
    const q = search.trim().toLowerCase();
    return (!filterExam || item.exam === filterExam) && (!filterSubject || item.subject === filterSubject) &&
      (!filterCategory || item.category === filterCategory) && (!filterStatus || item.status === filterStatus) &&
      (!q || [item.question, item.topic, item.chapter, item.subject, item.explanation].some((value) => value.toLowerCase().includes(q)));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [mistakes, filterExam, filterSubject, filterCategory, filterStatus, search]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function linkQuestion(value: string) {
    const [attemptId, questionId] = value.split("::");
    if (!attemptId || !questionId) { setDraft((current) => ({ ...current, testId: "", attemptId: "", questionId: "" })); return; }
    const linked = linkedAttempts.find((item) => item.attempt.id === attemptId && item.question.id === questionId);
    if (!linked) return;
    const exam: ExamCategory = linked.test.exam === "NEET UG" ? "NEET" : "JEE";
    setDraft((current) => ({ ...current, exam, subject: linked.question.subject, chapter: linked.question.chapter, topic: linked.question.topic,
      question: linked.question.prompt, studentAnswer: answerText(linked.response), explanation: linked.question.explanation,
      testId: linked.test.id, attemptId: linked.attempt.id, questionId: linked.question.id }));
  }
  function editMistake(item: MistakeRecord) {
    setEditing(item.id); setSelectedId(item.id); setShowForm(true);
    setDraft({ exam: item.exam, subject: item.subject, chapter: item.chapter, topic: item.topic, category: item.category,
      question: item.question, studentAnswer: item.studentAnswer, explanation: item.explanation, correctApproach: item.correctApproach,
      testId: item.testId || "", attemptId: item.attemptId || "", questionId: item.questionId || "" });
  }
  async function submitMistake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const questionText = draft.question.trim();
    if (!questionText || !draft.subject.trim() || !draft.chapter.trim() || !draft.explanation.trim() || !draft.correctApproach.trim()) {
      setError("Question, subject, chapter, mistake explanation, and correct approach are required."); return;
    }
    const now = new Date().toISOString();
    const existing = editing ? mistakes.find((item) => item.id === editing) : undefined;
    const item: MistakeRecord = { id: editing || crypto.randomUUID(), exam: draft.exam, subject: draft.subject.trim(), chapter: draft.chapter.trim(), topic: draft.topic.trim(),
      category: draft.category, status: existing?.status || "Needs Review", question: questionText, studentAnswer: draft.studentAnswer.trim(), explanation: draft.explanation.trim(), correctApproach: draft.correctApproach.trim(),
      source: draft.attemptId ? "mock-test" : "manual", testId: draft.testId || null, attemptId: draft.attemptId || null, questionId: draft.questionId || null,
      testTitle: tests.find((test) => test.id === draft.testId)?.title || existing?.testTitle || null, createdAt: existing?.createdAt || now, updatedAt: now };
    try {
      if (editing) { await mistakeRepository.update(item); setMistakes((items) => items.map((record) => record.id === item.id ? item : record)); }
      else { await mistakeRepository.add(item); setMistakes((items) => [...items, item]); }
      setDraft(emptyDraft()); setEditing(null); setShowForm(false); setError(""); setToast(editing ? "Mistake updated." : "Added to your Mistake Vault."); window.setTimeout(() => setToast(""), 2400);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this mistake."); }
  }
  async function updateStatus(item: MistakeRecord, status: MistakeStatus) {
    const next = { ...item, status, updatedAt: new Date().toISOString() };
    try { await mistakeRepository.update(next); setMistakes((items) => items.map((record) => record.id === item.id ? next : record)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update status."); }
  }
  function cancelForm() { setShowForm(false); setEditing(null); setDraft(emptyDraft()); setError(""); }
  const selected = mistakes.find((item) => item.id === selectedId);
  const subjects = [...new Set([...chapterSubjects, ...mistakes.map((item) => item.subject)])].sort();
  const countNeedsReview = mistakes.filter((item) => item.status === "Needs Review").length;

  return <main className={styles.page}>
    <header className={styles.topbar}><Link href="/tests" className={styles.back}><ArrowLeft size={15}/> Test center</Link><div className={styles.brand}><span>श</span> SHUNYA <small>MISTAKE VAULT</small></div><Link href="/focus/analytics" className={styles.navLink}>Focus analytics</Link></header>
    <div className={styles.content}>
      <div className={styles.hero}><div><div className={styles.kicker}><Sparkles size={12}/> LEARN FROM EVERY ATTEMPT</div><h1>Mistake Vault</h1><p>Capture the question, understand the cause, and record a better approach. Mistake categories are student-selected—not AI-inferred.</p></div><button className={styles.primary} onClick={() => { setEditing(null); setDraft(emptyDraft()); setShowForm((open) => !open); }}><Plus size={14}/> Add mistake</button></div>
      <section className={styles.summary}><article><CircleAlert size={15}/><div><b>{countNeedsReview}</b><span>Needs review</span></div></article><article><BookOpen size={15}/><div><b>{mistakes.length}</b><span>Total saved</span></div></article><article><Check size={15}/><div><b>{mistakes.filter((item) => item.status === "Resolved").length}</b><span>Resolved</span></div></article><Link href="/tests" className={styles.attemptLink}><ClipboardList size={14}/> {linkedAttempts.length} incorrect mock answers to review <ChevronDown size={12}/></Link></section>
      {showForm && <section className={styles.formCard}><div className={styles.formHead}><div><h2>{editing ? "Update mistake" : "Record a mistake"}</h2><p>Enter what happened and the correction that will help next time.</p></div><button aria-label="Close form" className={styles.close} onClick={cancelForm}><X size={15}/></button></div>
        <form onSubmit={submitMistake} className={styles.form}>
          <label>Exam<select value={draft.exam} disabled={!!draft.attemptId} onChange={(event) => updateDraft("exam", event.target.value as ExamCategory)}>{exams.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
          <label>Subject<input value={draft.subject} onChange={(event) => { updateDraft("subject", event.target.value); updateDraft("chapter", ""); }} maxLength={70} placeholder="e.g. Physics, Accounts, Polity" required/></label>
          <label>Chapter<input list="mistake-chapters" value={draft.chapter} onChange={(event) => updateDraft("chapter", event.target.value)} maxLength={100} placeholder="Chapter or area" required/><datalist id="mistake-chapters">{chapters.filter((item) => item.subject === draft.subject).map((chapter) => <option key={chapter.id} value={chapter.name}/>)}</datalist></label>
          <label>Topic <span>OPTIONAL</span><input value={draft.topic} onChange={(event) => updateDraft("topic", event.target.value)} maxLength={100} placeholder="Specific topic"/></label>
          <label>Mistake category<select value={draft.category} onChange={(event) => updateDraft("category", event.target.value as MistakeCategory)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          {!editing && <label className={styles.wide}>Link an incorrect mock-test answer <span>OPTIONAL · SUBMITTED ATTEMPTS ONLY</span><select value={draft.attemptId && draft.questionId ? `${draft.attemptId}::${draft.questionId}` : ""} onChange={(event) => linkQuestion(event.target.value)}><option value="">Manual entry / practice session</option>{linkedAttempts.map(({ attempt, test, question }, index) => <option key={`${attempt.id}-${question.id}`} value={`${attempt.id}::${question.id}`}>{test.title} · Q{test.questions.findIndex((item) => item.id === question.id) + 1} · {question.subject} · {question.chapter || "Chapter unspecified"} ({index + 1})</option>)}</select></label>}
          {draft.attemptId && <div className={`${styles.linkedNote} ${styles.wide}`}><Check size={13}/> Linked to {tests.find((item) => item.id === draft.testId)?.title || "submitted mock test"}. Question and answer were copied from the saved attempt; fields remain editable.</div>}
          <label className={styles.wide}>Question<textarea value={draft.question} onChange={(event) => updateDraft("question", event.target.value)} maxLength={3000} rows={3} required placeholder="Paste or summarize the question"/></label>
          <label className={styles.wide}>My answer <span>OPTIONAL</span><textarea value={draft.studentAnswer} onChange={(event) => updateDraft("studentAnswer", event.target.value)} maxLength={1500} rows={2} placeholder="What did you answer?"/></label>
          <label className={styles.wide}>What went wrong? <textarea value={draft.explanation} onChange={(event) => updateDraft("explanation", event.target.value)} maxLength={2000} rows={3} required placeholder="Describe the mistake in your own words"/></label>
          <label className={styles.wide}>Correct approach <textarea value={draft.correctApproach} onChange={(event) => updateDraft("correctApproach", event.target.value)} maxLength={2000} rows={3} required placeholder="Write the reliable method or key takeaway"/></label>
          <div className={styles.formActions}><button type="button" className={styles.secondary} onClick={cancelForm}>Cancel</button><button type="submit" className={styles.primary}><Check size={13}/>{editing ? "Save changes" : "Save mistake"}</button></div>
        </form>
      </section>}
      {error && <div role="alert" className={styles.error}>{error}</div>}
      <section className={styles.filters}>
        <label><span>Search</span><div className={styles.search}><Search size={13}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Question, topic, chapter"/></div></label>
        <label><span>Exam</span><select value={filterExam} onChange={(event) => setFilterExam(event.target.value)}><option value="">All exams</option>{exams.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
        <label><span>Subject</span><select value={filterSubject} onChange={(event) => setFilterSubject(event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
        <label><span>Category</span><select value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label><span>Status</span><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      </section>
      <section className={styles.vaultLayout}>
        <div className={styles.recordList}><div className={styles.listHeading}><h2>Saved mistakes <span>{filtered.length}</span></h2><button onClick={() => { setFilterExam(""); setFilterSubject(""); setFilterCategory(""); setFilterStatus(""); setSearch(""); }}>Clear filters</button></div>
          {loading ? <div className={styles.empty}>Loading saved mistakes…</div> : filtered.length ? filtered.map((item) => <button key={item.id} className={`${styles.record} ${selectedId === item.id ? styles.selected : ""}`} onClick={() => setSelectedId(item.id)}><div className={styles.recordTop}><span className={styles.category}>{item.category}</span><span className={`${styles.status} ${styles[item.status.replaceAll(" ", "").toLowerCase()]}`}>{item.status}</span></div><strong>{item.topic || item.chapter}</strong><span>{item.exam} · {item.subject} · {item.chapter}</span><p>{item.question}</p><small>{item.source === "mock-test" ? `Mock test · ${item.testTitle || "linked attempt"}` : "Manual entry"} · Updated {new Date(item.updatedAt).toLocaleDateString()}</small></button>) : <div className={styles.empty}><BookOpen size={20}/><b>No mistakes recorded</b><span>Add one manually or link an incorrect answer from a submitted mock test.</span></div>}
        </div>
        <aside className={styles.detailPanel}>{selected ? <><div className={styles.detailHead}><div><span className={styles.category}>{selected.category}</span><h2>{selected.topic || selected.chapter}</h2><p>{selected.exam} · {selected.subject} · {selected.chapter}</p></div><button aria-label="Edit mistake" className={styles.editButton} onClick={() => editMistake(selected)}><Pencil size={14}/> Edit</button></div><div className={styles.statusControl}><label htmlFor="mistake-status">Status</label><select id="mistake-status" value={selected.status} onChange={(event) => void updateStatus(selected, event.target.value as MistakeStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div><section><h3>Question</h3><p className={styles.detailText}>{selected.question}</p></section>{selected.studentAnswer && <section><h3>My answer</h3><p className={styles.detailText}>{selected.studentAnswer}</p></section>}<section><h3>What went wrong</h3><p className={styles.detailText}>{selected.explanation}</p></section><section><h3>Correct approach</h3><p className={styles.detailText}>{selected.correctApproach}</p></section><div className={styles.detailFooter}>{selected.testTitle ? <span><ClipboardList size={12}/> {selected.testTitle}</span> : <span>Practice / manual record</span>}<time>{new Date(selected.createdAt).toLocaleString()}</time></div></> : <div className={styles.detailEmpty}><BookOpen size={20}/><b>Choose a mistake to review</b><span>Select an entry to revisit its explanation and status.</span></div>}</aside>
      </section>
      <p className={styles.disclaimer}><CircleAlert size={12}/> Mistake categories are entered or confirmed by you. SHUNYA does not infer a student&apos;s thought process or automatically classify mistakes.</p>
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
