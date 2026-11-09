import { FocusSession } from "./focusSessionRepository";
import { Chapter } from "./chapterRepository";
import { MistakeRecord } from "./mistakeRepository";
import { RevisionSchedule } from "./revisionRepository";
import { StudyTest, TestAttempt } from "./testRepository";
import { buildChapterPerformance, getSubjectPerformance, uniqueSubmittedAttempts } from "./performanceAnalysis";

export type CoachExam = "JEE Main" | "JEE Advanced" | "NEET UG";
export type Recommendation = { id: string; title: string; action: string; reason: string; evidence: string; subject?: string; chapter?: string };
export type PlannerCommitment = { title: string; subject: string; chapter: string; date: string; status: string };
export const COACH_DECISIONS_KEY = "shunya-study-coach-decisions-v1";
const norm = (value: string) => value.trim().toLowerCase();
function isAnswered(value: unknown): value is string | string[] { return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0); }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function parseDate(date: string) { const result = new Date(date); return Number.isNaN(result.getTime()) ? null : result; }

export function readPlannerCommitments(): {items:PlannerCommitment[]; error:string|null} {
  if (typeof window === "undefined") return {items:[],error:null};
  try {
    const raw = window.localStorage.getItem("shunya-planner-v1");
    if (!raw) return {items:[],error:null};
    const parsed: unknown = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as {items?:unknown}).items) ? (parsed as {items:unknown[]}).items : [];
    return {items:items.flatMap((entry):PlannerCommitment[]=>{
      if (!entry || typeof entry !== "object") return [];
      const item=entry as Record<string,unknown>;
      if (typeof item.title !== "string" || typeof item.date !== "string") return [];
      return [{title:item.title,subject:typeof item.subject === "string"?item.subject:"",chapter:typeof item.chapter === "string"?item.chapter:"",date:item.date,status:typeof item.status === "string"?item.status:"planned"}];
    }),error:null};
  } catch { return {items:[],error:"Planner data could not be read; it was left unchanged."}; }
}

export function coachSnapshot(exam:CoachExam, tests:StudyTest[], attempts:TestAttempt[], chapters:Chapter[], mistakes:MistakeRecord[], revisions:RevisionSchedule[], focus:FocusSession[], commitments:PlannerCommitment[], now=new Date()) {
  const examTests = tests.filter((test)=> exam === "NEET UG" ? test.exam === "NEET UG" : test.exam === exam);
  const examTestIds = new Set(examTests.map((test)=>test.id));
  const validAttempts = uniqueSubmittedAttempts(attempts.filter((attempt)=>examTestIds.has(attempt.testId)));
  const chapterRows = buildChapterPerformance(examTests,validAttempts);
  const subjectRows = getSubjectPerformance(examTests,validAttempts);
  const chapterZones = chapters.map((chapter)=>({subject:chapter.subject,chapter:chapter.name,zone:chapter.zone}));
  const examMistakes = mistakes.filter((item)=> (exam === "NEET UG" ? item.exam === "NEET" : item.exam === "JEE") && item.status !== "Resolved");
  const examRevisions = revisions.filter((item)=>item.exam === (exam === "NEET UG" ? "NEET" : "JEE"));
  const focusRecords = focus.filter((session)=>session.focusedSeconds>0 && Number.isFinite(session.focusedSeconds) && (!session.subject || subjectRows.some((row)=>norm(row.subject)===norm(session.subject))));
  const today=dayKey(now);
  const weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-((now.getDay()+6)%7));
  const focusToday=focusRecords.filter((session)=>{const date=parseDate(session.startedAt);return !!date&&dayKey(date)===today;}).reduce((sum,item)=>sum+item.focusedSeconds,0);
  const focusWeek=focusRecords.filter((session)=>{const date=parseDate(session.startedAt);return !!date&&date>=weekStart&&date<=now;}).reduce((sum,item)=>sum+item.focusedSeconds,0);
  const pendingRevisions=examRevisions.filter((item)=>item.status==="active"&&!!item.nextDueDate);
  const overdueRevisions=pendingRevisions.filter((item)=>item.nextDueDate!<today);
  const dueRevisions=pendingRevisions.filter((item)=>item.nextDueDate!<=today);
  const recentAttempts=[...validAttempts].sort((a,b)=>(a.submittedAt||"").localeCompare(b.submittedAt||""));
  const recentScores=recentAttempts.slice(-5).map((attempt)=>({test:examTests.find((item)=>item.id===attempt.testId)?.title||"Mock test",date:attempt.submittedAt!,marks:attempt.result!.marksObtained,total:attempt.result!.totalMarks,accuracy:attempt.result!.accuracy}));
  const recommendations:Recommendation[]=[];
  if (overdueRevisions.length) recommendations.push({id:`overdue-${exam}`,title:`Complete ${overdueRevisions.length} overdue revision${overdueRevisions.length===1?"":"s"}`,action:`Review ${overdueRevisions.slice(0,3).map((item)=>item.chapter).join(", ")}${overdueRevisions.length>3?" and others":""}.`,reason:"Spaced-revision schedules are past their due date.",evidence:overdueRevisions.slice(0,3).map((item)=>`${item.chapter}: due ${item.nextDueDate}`).join(" · ")});
  const weak=chapterRows.filter((item)=>item.attempted>=5).sort((a,b)=>a.accuracy-b.accuracy)[0];
  if (weak && weak.accuracy<70) recommendations.push({id:`chapter-${exam}-${norm(weak.chapter)}`,title:`Revisit ${weak.chapter}`,action:`Review core ideas, then attempt a fresh ${weak.subject} question set.`,reason:"Chapter accuracy is based on answered questions from submitted tests.",evidence:`${weak.correct}/${weak.attempted} correct (${weak.accuracy}%) across ${weak.testCount} tests.`,subject:weak.subject,chapter:weak.chapter});
  const repeated=examMistakes.reduce((map,item)=>{const key=`${item.subject}|${item.chapter}`;map.set(key,[...(map.get(key)||[]),item]);return map;},new Map<string,MistakeRecord[]>);
  const repeatedEntry=[...repeated.entries()].filter(([,items])=>items.length>=2).sort((a,b)=>b[1].length-a[1].length)[0];
  if(repeatedEntry){const [key,items]=repeatedEntry;const [subject,chapter]=key.split("|");recommendations.push({id:`mistakes-${exam}-${norm(chapter)}`,title:`Review repeated mistakes in ${chapter}`,action:"Rework the linked questions and write one correction rule before your next test.",reason:"Multiple unresolved Mistake Vault records point to the same chapter.",evidence:`${items.length} unresolved entries · ${[...new Set(items.map((item)=>item.category))].join(", ")}.`,subject,chapter});}
  const weakSubject=[...subjectRows].filter((item)=>item.attempted>=5).sort((a,b)=>a.accuracy-b.accuracy)[0];
  if(weakSubject&&weakSubject.accuracy<65) recommendations.push({id:`subject-${exam}-${norm(weakSubject.subject)}`,title:`Give ${weakSubject.subject} a focused practice block`,action:"Use a timed set, then review each wrong answer in the Mistake Vault.",reason:"This subject is currently below 65% accuracy on sufficient answered-test evidence.",evidence:`${weakSubject.correct}/${weakSubject.attempted} correct (${weakSubject.accuracy}%).`,subject:weakSubject.subject});
  const plannedToday=commitments.filter((item)=>item.date===today&&item.status!=="completed");
  if(plannedToday.length)recommendations.push({id:`planner-${exam}-${today}`,title:"Protect today’s planned study blocks",action:`Start with ${plannedToday[0].title}${plannedToday[0].chapter?` · ${plannedToday[0].chapter}`:""}.`,reason:"Your saved planner has incomplete commitments for today.",evidence:`${plannedToday.length} incomplete planned item${plannedToday.length===1?"":"s"} today.`});
  if(!recommendations.length&&validAttempts.length===0)recommendations.push({id:`data-${exam}`,title:"Build a baseline with a mock test",action:"Create and submit a short subject or chapter test to unlock evidence-based recommendations.",reason:"There are no submitted test attempts for this exam yet.",evidence:"No score or accuracy data available; no performance judgment is made."});
  return {exam,subjects:subjectRows,chapters:chapterRows,chapterZones,attemptCount:validAttempts.length,answeredCount:chapterRows.reduce((sum,item)=>sum+item.attempted,0),overallAccuracy:chapterRows.reduce((sum,item)=>sum+item.attempted,0)?Math.round(chapterRows.reduce((sum,item)=>sum+item.correct,0)/chapterRows.reduce((sum,item)=>sum+item.attempted,0)*100):null,recentScores,focusTodaySeconds:focusToday,focusWeekSeconds:focusWeek,pendingRevisions:pendingRevisions.length,overdueRevisions:overdueRevisions.length,dueRevisionChapters:dueRevisions.map((item)=>item.chapter),mistakes:examMistakes.map((item)=>({subject:item.subject,chapter:item.chapter,topic:item.topic,category:item.category,status:item.status})),revisionEvents:examRevisions.flatMap((item)=>item.history.filter((event)=>event.action==="completed").map((event)=>({subject:item.subject,chapter:item.chapter,date:event.date,durationMinutes:event.durationMinutes}))),commitments:commitments.filter((item)=>item.status!=="completed"),recommendations,chapterRows};
}
