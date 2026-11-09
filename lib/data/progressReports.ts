import { FocusSession } from "./focusSessionRepository";
import { StudyTest, TestAttempt } from "./testRepository";
import { Flashcard } from "./flashcardRepository";
import { RevisionSchedule } from "./revisionRepository";
import { Chapter } from "./chapterRepository";
import { MistakeRecord } from "./mistakeRepository";
import { buildChapterPerformance } from "./performanceAnalysis";

export type ReportExam = "JEE Main" | "JEE Advanced" | "NEET UG";
export type ReportRange = { from: string; to: string };
export const REPORT_EXAMS: ReportExam[] = ["JEE Main", "JEE Advanced", "NEET UG"];

export function reportDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
export function rangeForPreset(preset: "7d"|"30d"|"90d", now=new Date()): ReportRange {
  const end=reportDateKey(now); const days=preset==="7d"?6:preset==="30d"?29:89; const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-days,12);
  return {from:reportDateKey(start),to:end};
}
export function validRange(range:ReportRange) { return !!range.from&&!!range.to&&range.from<=range.to; }
function dayRange(range:ReportRange) { const [fy,fm,fd]=range.from.split("-").map(Number); const [ty,tm,td]=range.to.split("-").map(Number); return {start:new Date(fy,fm-1,fd,0,0,0,0),end:new Date(ty,tm-1,td,23,59,59,999)}; }
function isInRange(value:string,range:ReportRange) { const date=new Date(value); if(Number.isNaN(date.getTime()))return false; const {start,end}=dayRange(range); return date>=start&&date<=end; }
function answered(value:unknown):value is string|string[] { return value!==undefined&&value!==""&&!(Array.isArray(value)&&value.length===0); }
function questionCorrect(question:StudyTest["questions"][number],value:string|string[]) {
  if(question.type==="Numerical")return Number(value)===Number(question.correctAnswer);
  const correct=(Array.isArray(question.correctAnswer)?question.correctAnswer:[question.correctAnswer]).map(String).sort(); const given=(Array.isArray(value)?value:[value]).map(String).sort(); return correct.length===given.length&&correct.every((item,index)=>item===given[index]);
}
export function uniqueReportAttempts(attempts:TestAttempt[]) { const seen=new Set<string>();return attempts.filter((attempt)=>{if(!attempt.id||seen.has(attempt.id)||!attempt.submittedAt||!attempt.result||Number.isNaN(Date.parse(attempt.submittedAt)))return false;seen.add(attempt.id);return true;}); }

export function buildProgressReport(input:{exam:ReportExam;range:ReportRange;focus:FocusSession[];tests:StudyTest[];attempts:TestAttempt[];revisions:RevisionSchedule[];flashcards:Flashcard[];chapters:Chapter[];mistakes:MistakeRecord[]}) {
  const {exam,range}=input;
  const examTests=input.tests.filter((test)=>test.exam===exam); const testMap=new Map(examTests.map((test)=>[test.id,test]));
  const attempts=uniqueReportAttempts(input.attempts).filter((attempt)=>testMap.has(attempt.testId)&&isInRange(attempt.submittedAt!,range)).sort((a,b)=>a.submittedAt!.localeCompare(b.submittedAt!));
  const focus=input.focus.filter((session)=>session.focusedSeconds>0&&Number.isFinite(session.focusedSeconds)&&isInRange(session.startedAt,range));
  const dailyMap=new Map<string,number>();
  focus.forEach((session)=>{const key=reportDateKey(new Date(session.startedAt));dailyMap.set(key,(dailyMap.get(key)||0)+session.focusedSeconds);});
  const {start,end}=dayRange(range); const dayCount=Math.floor((new Date(end.getFullYear(),end.getMonth(),end.getDate()).getTime()-new Date(start.getFullYear(),start.getMonth(),start.getDate()).getTime())/86400000)+1;
  const days=Array.from({length:dayCount},(_,index)=>{const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index,12);const key=reportDateKey(date);return {date:key,label:date.toLocaleDateString(undefined,{month:"numeric",day:"numeric"}),seconds:dailyMap.get(key)||0};});
  const focusSeconds=focus.reduce((sum,item)=>sum+item.focusedSeconds,0); const activeDays=days.filter((item)=>item.seconds>0).length;
  const subjects=[...new Set(examTests.flatMap((test)=>test.questions.map((question)=>question.subject)))];
  const subjectTime=subjects.map((subject)=>({subject,seconds:focus.filter((session)=>session.subject===subject).reduce((sum,item)=>sum+item.focusedSeconds,0)}));
  const subjectAccuracy=subjects.map((subject)=>{let total=0,correct=0;attempts.forEach((attempt)=>{const test=testMap.get(attempt.testId)!;test.questions.filter((question)=>question.subject===subject).forEach((question)=>{const value=attempt.answers[question.id]?.value;if(answered(value)){total++;if(questionCorrect(question,value))correct++;}});});return {subject,attempted:total,correct,accuracy:total?Math.round(correct/total*100):null};});
  const scoreTrend=attempts.map((attempt)=>{const test=testMap.get(attempt.testId)!;return {id:attempt.id,title:test.title,submittedAt:attempt.submittedAt!,score:attempt.result!.marksObtained,total:attempt.result!.totalMarks,accuracy:attempt.result!.accuracy};});
  const chapterAccuracy=buildChapterPerformance(examTests,attempts).sort((a,b)=>a.accuracy-b.accuracy);
  const revisions=input.revisions.filter((schedule)=>schedule.exam===(exam==="NEET UG"?"NEET":"JEE"));
  const revisionEvents=revisions.flatMap((schedule)=>schedule.history.filter((event)=>event.action==="completed"&&event.date>=range.from&&event.date<=range.to).map((event)=>({date:event.date,chapter:schedule.chapter,subject:schedule.subject,durationMinutes:event.durationMinutes})));
  const revisionDaily=new Map<string,number>();revisionEvents.forEach((event)=>revisionDaily.set(event.date,(revisionDaily.get(event.date)||0)+1));
  const revisionDailySeries=days.map((day)=>({date:day.date,label:day.label,count:revisionDaily.get(day.date)||0}));
  const examSubjects=new Set(subjects);
  const cards=input.flashcards.filter((card)=>card.exam===exam&&examSubjects.has(card.subject));
  const cardReviews=cards.flatMap((card)=>card.reviews.filter((review)=>isInRange(review.reviewedAt,range)).map((review)=>({card,review})));
  const flashcardSeries=days.map((day)=>({date:day.date,label:day.label,count:cardReviews.filter((item)=>reportDateKey(new Date(item.review.reviewedAt))===day.date).length}));
  const recallAccuracy=cardReviews.length?Math.round(cardReviews.filter((item)=>item.review.rating==="Good"||item.review.rating==="Easy").length/cardReviews.length*100):null;
  const consistency=dayCount?Math.round(activeDays/dayCount*100):0;
  const completedRevisionCount=revisionEvents.length; const pendingRevisions=revisions.filter((item)=>item.status==="active"&&!!item.nextDueDate).length;
  const completedRevisions=revisions.reduce((sum,item)=>sum+item.history.filter((event)=>event.action==="completed"&&event.date>=range.from&&event.date<=range.to).length,0);
  const relevantMistakes=input.mistakes.filter((item)=>(exam==="NEET UG"?item.exam==="NEET":item.exam==="JEE")&&item.updatedAt.slice(0,10)>=range.from&&item.updatedAt.slice(0,10)<=range.to);
  const cardsReviewed=new Set(cardReviews.map((item)=>item.card.id)).size;
  const strongChapters=chapterAccuracy.filter((item)=>item.attempted>=5&&item.accuracy>=80).sort((a,b)=>b.accuracy-a.accuracy).slice(0,5);
  const attentionChapters=chapterAccuracy.filter((item)=>item.attempted>=5&&item.accuracy<65).slice(0,5);
  const weekSeconds=focusSeconds;
  const goals=[pendingRevisions?`Complete ${Math.min(pendingRevisions,3)} pending chapter revision${pendingRevisions===1?"":"s"}.`:null,attentionChapters[0]?`Review ${attentionChapters[0].chapter} (${attentionChapters[0].accuracy}% across ${attentionChapters[0].attempted} answers).`:null,scoreTrend.length?"Take one timed mock or subject test and review the errors.":"Submit a mock test to establish a performance baseline."].filter(Boolean).slice(0,3) as string[];
  return {exam,range,focusSeconds,activeDays,dayCount,consistency,days,subjectTime,subjectAccuracy,scoreTrend,chapterAccuracy,strongChapters,attentionChapters,revisionEvents,revisionDailySeries,completedRevisionCount,pendingRevisions,flashcardCount:cards.length,cardsReviewed,cardReviews:cardReviews.length,recallAccuracy,flashcardSeries,relevantMistakes,goals,weeklyFocusHours:weekSeconds};
}
export function formatReportTime(seconds:number){const hours=Math.floor(seconds/3600);const minutes=Math.floor((seconds%3600)/60);return hours?`${hours}h ${minutes}m`:`${minutes}m`;}
