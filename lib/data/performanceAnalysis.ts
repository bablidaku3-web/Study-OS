import { Chapter, Zone } from "./chapterRepository";
import { MistakeRecord } from "./mistakeRepository";
import { StudyTest, TestAttempt } from "./testRepository";

export type ZoneSuggestion = {
  chapterId: string;
  subject: string;
  chapter: string;
  zone: Zone;
  answered: number;
  accuracy: number;
  mistakeCount: number;
  repeatedCategories: { category: string; count: number }[];
  reason: string;
};
export type ChapterPerformance = {
  subject: string;
  chapter: string;
  attempted: number;
  correct: number;
  accuracy: number;
  testCount: number;
  recentAccuracy: number | null;
  previousAccuracy: number | null;
};

export const MIN_ZONE_ATTEMPTS = 5;
const normalized = (value: string) => value.trim().toLocaleLowerCase();
function isAnswered(value: unknown): value is string | string[] {
  return value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
}
function correctAnswer(question: StudyTest["questions"][number], response: string | string[]) {
  if (question.type === "Numerical") return Number(response) === Number(question.correctAnswer);
  const expected = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer]).map(String).sort();
  const given = (Array.isArray(response) ? response : [response]).map(String).sort();
  return expected.length === given.length && expected.every((value, index) => value === given[index]);
}
export function uniqueSubmittedAttempts(attempts: TestAttempt[]) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    if (!attempt.id || seen.has(attempt.id) || !attempt.submittedAt || !attempt.result || Number.isNaN(Date.parse(attempt.submittedAt))) return false;
    seen.add(attempt.id);
    return true;
  });
}
export function buildChapterPerformance(tests: StudyTest[], attempts: TestAttempt[]) {
  const testById = new Map(tests.map((test) => [test.id, test]));
  const accum = new Map<string, { subject: string; chapter: string; attempted: number; correct: number; tests: Map<string, { attempted: number; correct: number; at: string }> }>();
  uniqueSubmittedAttempts(attempts).forEach((attempt) => {
    const test = testById.get(attempt.testId);
    if (!test) return;
    test.questions.forEach((question) => {
      const answer = attempt.answers[question.id]?.value;
      if (!isAnswered(answer)) return;
      const key = `${normalized(question.subject)}\u0000${normalized(question.chapter)}`;
      const row = accum.get(key) || { subject: question.subject.trim(), chapter: question.chapter.trim(), attempted: 0, correct: 0, tests: new Map() };
      row.attempted += 1;
      const hit = correctAnswer(question, answer);
      if (hit) row.correct += 1;
      const testRow = row.tests.get(attempt.id) || { attempted: 0, correct: 0, at: attempt.submittedAt! };
      testRow.attempted += 1; if (hit) testRow.correct += 1;
      row.tests.set(attempt.id, testRow); accum.set(key, row);
    });
  });
  return [...accum.values()].map((row): ChapterPerformance => {
    const perTest = [...row.tests.values()].sort((a, b) => a.at.localeCompare(b.at));
    const recent = perTest.slice(-2); const prior = perTest.slice(-4, -2);
    const accuracyOf = (items: typeof perTest) => {
      const attemptsCount = items.reduce((sum, item) => sum + item.attempted, 0);
      return attemptsCount ? Math.round(items.reduce((sum, item) => sum + item.correct, 0) / attemptsCount * 100) : null;
    };
    return { subject: row.subject, chapter: row.chapter, attempted: row.attempted, correct: row.correct,
      accuracy: Math.round(row.correct / row.attempted * 100), testCount: row.tests.size,
      recentAccuracy: accuracyOf(recent), previousAccuracy: accuracyOf(prior) };
  }).sort((a, b) => b.attempted - a.attempted);
}
export function suggestChapterZones(chapters: Chapter[], tests: StudyTest[], attempts: TestAttempt[], mistakes: MistakeRecord[]) {
  const performance = buildChapterPerformance(tests, attempts);
  return performance.flatMap((item): ZoneSuggestion[] => {
    const chapter = chapters.find((candidate) => normalized(candidate.subject) === normalized(item.subject) && normalized(candidate.name) === normalized(item.chapter));
    if (!chapter) return [];
    const chapterMistakes = mistakes.filter((mistake) => normalized(mistake.subject) === normalized(item.subject) && normalized(mistake.chapter) === normalized(item.chapter) && mistake.status !== "Resolved");
    const categories = new Map<string, number>();
    chapterMistakes.forEach((mistake) => categories.set(mistake.category, (categories.get(mistake.category) || 0) + 1));
    const repeatedCategories = [...categories.entries()].filter(([, count]) => count >= 2).map(([category, count]) => ({ category, count }));
    let zone: Zone;
    let reason: string;
    if (item.attempted < MIN_ZONE_ATTEMPTS) {
      if (chapterMistakes.length < 3) return [];
      zone = "red";
      reason = `${chapterMistakes.length} unresolved Mistake Vault entries for this chapter; only ${item.attempted}/${MIN_ZONE_ATTEMPTS} answered test questions, so accuracy alone is insufficient.`;
    } else if (item.accuracy >= 80 && (item.recentAccuracy === null || item.recentAccuracy >= 70) && chapterMistakes.length < 2) {
      zone = "green";
      reason = `${item.correct}/${item.attempted} answered questions correct (${item.accuracy}%), recent accuracy ${item.recentAccuracy ?? item.accuracy}%, and fewer than 2 unresolved mistakes.`;
    } else if (item.accuracy <= 45 || chapterMistakes.length >= 3 || (item.recentAccuracy !== null && item.recentAccuracy < 40)) {
      zone = "red";
      reason = `${item.correct}/${item.attempted} answered questions correct (${item.accuracy}%)${chapterMistakes.length >= 3 ? ` and ${chapterMistakes.length} unresolved mistakes` : ""}${item.recentAccuracy !== null && item.recentAccuracy < 40 ? `; recent accuracy is ${item.recentAccuracy}%` : ""}.`;
    } else {
      zone = "yellow";
      reason = `${item.correct}/${item.attempted} answered questions correct (${item.accuracy}%). Evidence is mixed or below the strong threshold; review and gather more results.`;
    }
    if (item.recentAccuracy !== null && item.previousAccuracy !== null) {
      const delta = item.recentAccuracy - item.previousAccuracy;
      reason += ` Recent test accuracy ${delta >= 0 ? "improved" : "fell"} ${Math.abs(delta)} percentage points versus the preceding tests.`;
    }
    if (repeatedCategories.length) reason += ` Repeated unresolved categories: ${repeatedCategories.map((entry) => `${entry.category} (${entry.count})`).join(", ")}.`;
    return [{ chapterId: chapter.id, subject: item.subject, chapter: item.chapter, zone, answered: item.attempted, accuracy: item.accuracy, mistakeCount: chapterMistakes.length, repeatedCategories, reason }];
  });
}
export function getSubjectPerformance(tests: StudyTest[], attempts: TestAttempt[]) {
  const testById = new Map(tests.map((test) => [test.id, test]));
  const map = new Map<string, { attempted: number; correct: number; testIds: Set<string> }>();
  uniqueSubmittedAttempts(attempts).forEach((attempt) => {
    const test = testById.get(attempt.testId); if (!test) return;
    test.questions.forEach((question) => {
      const answer = attempt.answers[question.id]?.value; if (!isAnswered(answer)) return;
      const row = map.get(question.subject) || { attempted: 0, correct: 0, testIds: new Set<string>() };
      row.attempted++; if (correctAnswer(question, answer)) row.correct++; row.testIds.add(attempt.id); map.set(question.subject, row);
    });
  });
  return [...map.entries()].map(([subject, row]) => ({ subject, attempted: row.attempted, correct: row.correct, accuracy: Math.round(row.correct / row.attempted * 100), testCount: row.testIds.size })).sort((a, b) => b.attempted - a.attempted);
}
type RevisionImpact = { scheduleId: string; subject: string; chapter: string; beforeAccuracy: number | null; afterAccuracy: number | null; beforeCount: number; afterCount: number; message: string };
export function revisionImpact(schedules: import("./revisionRepository").RevisionSchedule[], tests: StudyTest[], attempts: TestAttempt[]): RevisionImpact[] {
  const testById = new Map(tests.map((test) => [test.id, test]));
  return schedules.flatMap((schedule): RevisionImpact[] => {
    const revisionDates = schedule.history.filter((event) => event.action === "completed").map((event) => event.date).sort();
    if (!revisionDates.length) return [];
    const firstRevision = revisionDates[0];
    const matching = uniqueSubmittedAttempts(attempts).flatMap((attempt) => {
      if (!attempt.submittedAt) return [];
      const test = testById.get(attempt.testId); if (!test) return [];
      const relevant = test.questions.filter((question) => normalized(question.subject) === normalized(schedule.subject) && normalized(question.chapter) === normalized(schedule.chapter) && isAnswered(attempt.answers[question.id]?.value));
      if (!relevant.length) return [];
      const correct = relevant.filter((question) => correctAnswer(question, attempt.answers[question.id].value)).length;
      return [{ date: attempt.submittedAt.slice(0, 10), attempted: relevant.length, correct }];
    }).sort((a, b) => a.date.localeCompare(b.date));
    const before = matching.filter((entry) => entry.date < firstRevision);
    const after = matching.filter((entry) => entry.date > firstRevision);
    const beforeCount = before.reduce((sum, entry) => sum + entry.attempted, 0);
    const afterCount = after.reduce((sum, entry) => sum + entry.attempted, 0);
    if (beforeCount < MIN_ZONE_ATTEMPTS || afterCount < MIN_ZONE_ATTEMPTS) return [{ scheduleId: schedule.id, subject: schedule.subject, chapter: schedule.chapter, beforeAccuracy: null, afterAccuracy: null, beforeCount, afterCount, message: `Insufficient comparison data: need ${MIN_ZONE_ATTEMPTS} answered questions before and after revision; found ${beforeCount} and ${afterCount}.` }];
    const beforeCorrect = before.reduce((sum, entry) => sum + entry.correct, 0); const afterCorrect = after.reduce((sum, entry) => sum + entry.correct, 0);
    const beforeAccuracy = Math.round(beforeCorrect / beforeCount * 100); const afterAccuracy = Math.round(afterCorrect / afterCount * 100);
    return [{ scheduleId: schedule.id, subject: schedule.subject, chapter: schedule.chapter, beforeAccuracy, afterAccuracy, beforeCount, afterCount, message: `Observed accuracy ${beforeAccuracy}% before and ${afterAccuracy}% after revision (${afterAccuracy - beforeAccuracy >= 0 ? "+" : ""}${afterAccuracy - beforeAccuracy} points). This is an association, not proof revision caused the change.` }];
  });
}
