"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, Send } from "lucide-react";
import { TestAttempt, TestQuestion, TestResult, StudyTest, testRepository } from "@/lib/data/testRepository";
import styles from "../tests.module.css";

function emptyAttempt(testId: string, seconds: number): TestAttempt {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), testId, startedAt: now, updatedAt: now, currentQuestion: 0, answers: {}, markedForReview: [], submittedAt: null, result: null };
}
function isCorrect(question: TestQuestion, answer: string | string[] | undefined) {
  if (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0)) return false;
  if (question.type === "Numerical") return Number(answer) === Number(question.correctAnswer);
  const expected = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String).sort();
  const given = (Array.isArray(answer) ? answer : [answer]).map(String).sort();
  return expected.length === given.length && expected.every((value,index)=>value===given[index]);
}
function calculateTestResult(test: StudyTest, attempt: TestAttempt, submittedAt = new Date().toISOString()): TestResult {
  const subjectMap = new Map<string,{marks:number;total:number;correct:number;incorrect:number}>();
  const chapterMap = new Map<string,{subject:string;chapter:string;marks:number;total:number;correct:number;incorrect:number}>();
  let marksObtained = 0; let correct = 0; let incorrect = 0; let unattempted = 0;
  const timePerQuestion = test.questions.map((question)=>({questionId:question.id,seconds:Math.max(0,Math.floor(attempt.answers[question.id]?.secondsSpent || 0))}));
  for (const question of test.questions) {
    const response = attempt.answers[question.id]?.value;
    const hasAnswer = response !== undefined && response !== "" && !(Array.isArray(response) && response.length === 0);
    const hit = hasAnswer && isCorrect(question,response);
    const score = hit ? question.positiveMarks : hasAnswer ? -question.negativeMarks : 0;
    marksObtained += score;
    if (!hasAnswer) unattempted++; else if (hit) correct++; else incorrect++;
    const subject = subjectMap.get(question.subject) || {marks:0,total:0,correct:0,incorrect:0};
    subject.marks += score; subject.total += question.positiveMarks; if (!hasAnswer) {} else if (hit) subject.correct++; else subject.incorrect++;
    subjectMap.set(question.subject,subject);
    const key = `${question.subject}::${question.chapter}`;
    const chapter = chapterMap.get(key) || {subject:question.subject,chapter:question.chapter,marks:0,total:0,correct:0,incorrect:0};
    chapter.marks += score; chapter.total += question.positiveMarks; if (hasAnswer && hit) chapter.correct++; else if (hasAnswer) chapter.incorrect++;
    chapterMap.set(key,chapter);
  }
  const totalMarks = test.questions.reduce((sum,question)=>sum+question.positiveMarks,0);
  const answered = correct + incorrect;
  return { totalMarks, marksObtained, correct, incorrect, unattempted, accuracy: answered ? Math.round(correct / answered * 100) : 0,
    subjectScores:[...subjectMap.entries()].map(([subject,value])=>({subject,...value})),
    chapterScores:[...chapterMap.values()],timePerQuestion };
}

export default function TestRunnerPage() {
  const params = useParams<{ id: string }>();
  const testId = params.id;
  const [test,setTest] = useState<StudyTest|null>(null);
  const [attempt,setAttempt] = useState<TestAttempt|null>(null);
  const [remaining,setRemaining] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [confirmSubmit,setConfirmSubmit] = useState(false);
  const [result,setResult] = useState<TestResult|null>(null);
  const [now,setNow] = useState(Date.now());
  const currentQuestion = test && attempt ? test.questions[attempt.currentQuestion] : null;

  useEffect(()=>{ Promise.all([testRepository.getTest(testId),testRepository.getAttempt(testId)]).then(([savedTest,savedAttempt])=>{if(!savedTest){setError("Test not found.");return;} setTest(savedTest); if(savedAttempt){setAttempt(savedAttempt);setResult(savedAttempt.result);if(!savedAttempt.submittedAt){const seconds=Math.max(0,savedTest.durationMinutes*60-Math.floor((Date.now()-new Date(savedAttempt.startedAt).getTime())/1000));setRemaining(seconds);}}else{const attempt=emptyAttempt(testId,savedTest.durationMinutes*60);setAttempt(attempt);setRemaining(savedTest.durationMinutes*60);void testRepository.saveAttempt(attempt);}}).catch((cause:unknown)=>setError(cause instanceof Error?cause.message:"Could not load test.")).finally(()=>setLoading(false));},[testId]);
  useEffect(()=>{if(!attempt||attempt.submittedAt)return;const interval=window.setInterval(()=>{setNow(Date.now());const end=new Date(attempt.startedAt).getTime()+((test?.durationMinutes||0)*60*1000);setRemaining(Math.max(0,Math.ceil((end-Date.now())/1000)));},250);return()=>window.clearInterval(interval);},[attempt,test]);
  const persist=useCallback((next:TestAttempt)=>{setAttempt(next);void testRepository.saveAttempt(next).catch((cause:unknown)=>setError(cause instanceof Error?cause.message:"Could not save your response."));},[]);
  const submit=useCallback(async()=>{if(!test||!attempt||attempt.submittedAt)return;const submittedAt=new Date().toISOString();const calculated=calculateTestResult(test,attempt,submittedAt);const finalAttempt={...attempt,submittedAt,updatedAt:submittedAt,result:calculated};try{await testRepository.saveAttempt(finalAttempt);setAttempt(finalAttempt);setResult(calculated);setConfirmSubmit(false);}catch(cause){setError(cause instanceof Error?cause.message:"Unable to submit test.");}},[test,attempt]);
  useEffect(()=>{if(remaining===0&&test&&attempt&&!attempt.submittedAt&& !loading)void submit();},[remaining,test,attempt,loading,submit]);
  if(loading)return <main className={styles.page}><div className={styles.empty}>Loading test…</div></main>;
  if(!test||!attempt)return <main className={styles.page}><div className={styles.error}>{error||"Test unavailable."}</div><Link href="/tests" className={styles.primary}>Back to tests</Link></main>;
  const answeredCount=Object.values(attempt.answers).filter((answer)=>answer.value!==""&&!(Array.isArray(answer.value)&&!answer.value.length)).length;
  const updateAnswer=(value:string|string[])=>{const previous=attempt.answers[currentQuestion!.id];const next={...attempt,answers:{...attempt.answers,[currentQuestion!.id]:{value,visitedAt:previous?.visitedAt||new Date().toISOString(),secondsSpent:previous?.secondsSpent||0}},updatedAt:new Date().toISOString()};persist(next);};
  const navigate=(index:number)=>{if(index<0||index>=test.questions.length||index===attempt.currentQuestion)return;const previousQuestion=test.questions[attempt.currentQuestion];const answers={...attempt.answers};const previous=answers[previousQuestion.id];if(previous)answers[previousQuestion.id]={...previous,secondsSpent:previous.secondsSpent+Math.max(0,Math.floor((Date.now()-new Date(previous.visitedAt).getTime())/1000)),visitedAt:new Date().toISOString()};const target=test.questions[index];const targetAnswer=answers[target.id];if(targetAnswer)answers[target.id]={...targetAnswer,visitedAt:new Date().toISOString()};else answers[target.id]={value:"",visitedAt:new Date().toISOString(),secondsSpent:0};persist({...attempt,currentQuestion:index,answers,updatedAt:new Date().toISOString()});};
  const toggleReview=()=>{const marked=attempt.markedForReview.includes(currentQuestion!.id);persist({...attempt,markedForReview:marked?attempt.markedForReview.filter((id)=>id!==currentQuestion!.id):[...attempt.markedForReview,currentQuestion!.id],updatedAt:new Date().toISOString()});};
  const saveAndNext=()=>navigate(Math.min(test.questions.length-1,attempt.currentQuestion+1));
  if(result)return <main className={styles.page}><header className={styles.topbar}><Link href="/tests" className={styles.back}><ArrowLeft size={15}/> Test center</Link><div className={styles.brand}><span>श</span> SHUNYA <small>TEST RESULT</small></div><span/></header><div className={styles.content}><div className={styles.hero}><div><div className={styles.kicker}>{test.exam} · SUBMITTED {new Date(attempt.submittedAt!).toLocaleString()}</div><h1>{test.title}</h1><p>Your answers have been saved. This attempt cannot be submitted again.</p></div></div><section className={styles.resultGrid}><article><small>MARKS OBTAINED</small><strong>{result.marksObtained} / {result.totalMarks}</strong></article><article><small>ACCURACY</small><strong>{result.accuracy}%</strong></article><article><small>CORRECT</small><strong>{result.correct}</strong></article><article><small>INCORRECT</small><strong>{result.incorrect}</strong></article><article><small>UNATTEMPTED</small><strong>{result.unattempted}</strong></article></section><div className={styles.resultColumns}><section className={styles.createCard}><h2>Subject performance</h2>{result.subjectScores.map((item)=><div className={styles.scoreRow} key={item.subject}><span>{item.subject}</span><b>{item.marks} / {item.total}</b><small>{item.correct} correct · {item.incorrect} incorrect</small></div>)}</section><section className={styles.createCard}><h2>Chapter performance</h2>{result.chapterScores.map((item)=><div className={styles.scoreRow} key={`${item.subject}-${item.chapter}`}><span>{item.chapter}</span><b>{item.marks} / {item.total}</b><small>{item.subject} · {item.correct} correct · {item.incorrect} incorrect</small></div>)}</section></div><section className={styles.createCard}><h2>Time per question</h2>{test.questions.map((question,index)=><div className={styles.scoreRow} key={question.id}><span>Q{index+1} · {question.subject} · {question.topic||question.chapter}</span><b>{Math.floor((result.timePerQuestion.find((item)=>item.questionId===question.id)?.seconds||0)/60)}m {((result.timePerQuestion.find((item)=>item.questionId===question.id)?.seconds||0)%60)}s</b></div>)}</section><Link href="/tests" className={styles.primary}>Return to test center</Link></div></main>;
  const answer=attempt.answers[currentQuestion!.id]?.value??"";
  const statusOf=(question:TestQuestion)=>{const response=attempt.answers[question.id]?.value;const answered=response!==undefined&&response!==""&&!(Array.isArray(response)&&response.length===0);const review=attempt.markedForReview.includes(question.id);return review?"review":answered?"answered":attempt.answers[question.id]?"notanswered":"notvisited";};
  return <main className={styles.page}><header className={styles.topbar}><Link href="/tests" className={styles.back}><ArrowLeft size={15}/> Exit test</Link><div className={styles.brand}><span>श</span> SHUNYA <small>{test.exam.toUpperCase()}</small></div><div className={styles.timer}><Clock3 size={14}/>{String(Math.floor(remaining/60)).padStart(2,"0")}:{String(remaining%60).padStart(2,"0")}</div></header><div className={styles.content}><div className={styles.testHeading}><div><div className={styles.kicker}>{test.title} · {test.questions.length} QUESTIONS</div><h1>Question {attempt.currentQuestion+1} <small>of {test.questions.length}</small></h1></div><button className={styles.submitButton} onClick={()=>setConfirmSubmit(true)}><Send size={13}/> Submit test</button></div><div className={styles.examLayout}><section className={styles.questionCard}><div className={styles.questionMeta}><span>{currentQuestion!.subject}</span><span>{currentQuestion!.chapter}</span><span>{currentQuestion!.type}</span><span>+{currentQuestion!.positiveMarks} / -{currentQuestion!.negativeMarks}</span></div><p className={styles.prompt}>{currentQuestion!.prompt}</p>{currentQuestion!.type==="Numerical"?<label className={styles.numerical}>Your numerical answer<input type="number" value={typeof answer==="string"?answer:""} onChange={(event)=>updateAnswer(event.target.value)}/></label>:<div className={styles.answerOptions}>{currentQuestion!.options.map((option,index)=>{const selected=Array.isArray(answer)?answer.includes(option):answer===option;return <button key={index} className={`${styles.answerOption} ${selected?styles.selectedOption:""}`} onClick={()=>{if(currentQuestion!.type==="MCQ")updateAnswer(selected?"":option);else{const values=Array.isArray(answer)?answer:[];updateAnswer(selected?values.filter((value)=>value!==option):[...values,option]);}}}><span>{String.fromCharCode(65+index)}</span>{option}{selected&&<Check size={14}/>}</button>;})}</div>}<div className={styles.questionActions}><button className={styles.secondary} onClick={toggleReview}><Bookmark size={13}/>{attempt.markedForReview.includes(currentQuestion!.id)?"Unmark review":"Mark for review"}</button><span>Saved automatically</span></div><div className={styles.navButtons}><button className={styles.secondary} onClick={()=>navigate(attempt.currentQuestion-1)} disabled={attempt.currentQuestion===0}><ChevronLeft size={14}/> Previous</button><button className={styles.primary} onClick={saveAndNext}>Save & Next <ChevronRight size={14}/></button></div></section><aside className={styles.navigator}><h2>Question navigator</h2><p>{answeredCount} of {test.questions.length} answered</p><div className={styles.questionGrid}>{test.questions.map((question,index)=><button key={question.id} className={`${styles.questionNumber} ${styles[statusOf(question)]} ${index===attempt.currentQuestion?styles.currentQuestion:""}`} onClick={()=>navigate(index)} aria-label={`Question ${index+1}, ${statusOf(question)}`}>{index+1}</button>)}</div><div className={styles.legend}><span><i className={styles.answeredDot}/>Answered</span><span><i className={styles.reviewDot}/>Review</span><span><i className={styles.notvisitedDot}/>Not visited</span></div><button className={styles.submitButton} onClick={()=>setConfirmSubmit(true)}>Submit test</button></aside></div></div>{confirmSubmit&&<div className={styles.modalBackdrop}><section className={styles.modal}><h2>Submit this test?</h2><p>{answeredCount} answered · {test.questions.length-answeredCount} unattempted. You can’t edit answers after submission.</p><div><button className={styles.secondary} onClick={()=>setConfirmSubmit(false)}>Continue test</button><button className={styles.submitButton} onClick={()=>void submit()}>Confirm submission</button></div></section></div>}{error&&<div className={styles.error} role="alert">{error}</div>}</main>;
}
