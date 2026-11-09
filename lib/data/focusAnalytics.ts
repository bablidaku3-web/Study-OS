import { FocusSession } from "./focusSessionRepository";
import { Chapter } from "./chapterRepository";

export type FocusFilter = { from?: string; to?: string; subject?: string; activity?: string };
export const ANALYTICS_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;
export const ANALYTICS_ACTIVITIES = ["Theory", "Numericals", "PYQs", "Practice", "Revision"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}
function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Retain unique zero-focus break sessions for session counts/history; only focus seconds enter time totals. */
export function uniqueFocusSessions(sessions: FocusSession[]) {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (!session.id || seen.has(session.id) || !parseDate(session.startedAt) || !parseDate(session.endedAt)) return false;
    seen.add(session.id);
    return Number.isFinite(session.focusedSeconds) && session.focusedSeconds >= 0;
  });
}

export function filterFocusSessions(sessions: FocusSession[], filters: FocusFilter) {
  return sessions.filter((session) => {
    const date = parseDate(session.startedAt);
    if (!date) return false;
    const key = localDateKey(date);
    return !(filters.from && key < filters.from) && !(filters.to && key > filters.to) &&
      !(filters.subject && session.subject !== filters.subject) && !(filters.activity && session.activity !== filters.activity);
  });
}

export function buildAnalytics(sessions: FocusSession[], reference = new Date(), syllabus: Chapter[] = []) {
  const records = uniqueFocusSessions(sessions);
  const studyRecords = records.filter((session) => session.focusedSeconds > 0);
  const todayKey = localDateKey(reference);
  const weekStart = startOfWeek(reference);
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const total = (list: FocusSession[]) => list.reduce((sum, item) => sum + item.focusedSeconds, 0);
  const dateInHalfOpenRange = (session: FocusSession, start: Date, end: Date) => {
    const date = parseDate(session.startedAt);
    return !!date && date >= start && date < end;
  };
  const today = studyRecords.filter((session) => { const date = parseDate(session.startedAt); return !!date && localDateKey(date) === todayKey; });
  const week = studyRecords.filter((session) => dateInHalfOpenRange(session, weekStart, new Date(reference.getTime() + 1)));
  const month = studyRecords.filter((session) => dateInHalfOpenRange(session, monthStart, new Date(reference.getTime() + 1)));
  const completed = records.filter((session) => session.status === "completed").length;
  const interrupted = records.filter((session) => session.status === "interrupted").length;
  const totalSessions = completed + interrupted;
  const dailyMap = new Map<string, number>();
  studyRecords.forEach((session) => {
    const date = parseDate(session.startedAt);
    if (!date) return;
    const key = localDateKey(date);
    dailyMap.set(key, (dailyMap.get(key) || 0) + session.focusedSeconds);
  });
  const allSeconds = total(studyRecords);
  const subjects = ANALYTICS_SUBJECTS.map((name) => ({ name, seconds: total(studyRecords.filter((session) => session.subject === name)) }));
  const subjectsWithData = subjects.filter((item) => item.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  const groupBy = (key: (session: FocusSession) => string, unknownLabel: string) => {
    const map = new Map<string, number>();
    studyRecords.forEach((session) => {
      const name = key(session).trim() || unknownLabel;
      map.set(name, (map.get(name) || 0) + session.focusedSeconds);
    });
    return Array.from(map.entries()).map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds);
  };
  const chapters = groupBy((session) => session.chapter, "Unspecified chapter");
  const topics = groupBy((session) => session.topic, "Unspecified topic");
  const chaptersSeen = new Set(studyRecords.map((session) => `${session.subject}\u0000${session.chapter.trim().toLowerCase()}`));
  const neglectedChapters = syllabus.filter((chapter) => !chaptersSeen.has(`${chapter.subject}\u0000${chapter.name.trim().toLowerCase()}`));
  const activities = ANALYTICS_ACTIVITIES.map((name) => ({ name, seconds: total(studyRecords.filter((session) => session.activity === name)) }));
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index);
    const key = localDateKey(date);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), key, seconds: dailyMap.get(key) || 0 };
  });
  const weekly = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - (3 - index) * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), key: localDateKey(start), seconds: total(studyRecords.filter((session) => dateInHalfOpenRange(session, start, end))) };
  });
  const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const monthly = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth(), index + 1);
    const key = localDateKey(date);
    return { label: String(index + 1), key, seconds: dailyMap.get(key) || 0 };
  });
  const activeDays = new Set(studyRecords.map((session) => { const date = parseDate(session.startedAt); return date ? localDateKey(date) : ""; }).filter(Boolean)).size;
  const productiveDay = [...daily].filter((day) => day.seconds > 0).sort((a, b) => b.seconds - a.seconds)[0] || null;
  const previousWeekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7);
  const previousWeekSeconds = total(studyRecords.filter((session) => dateInHalfOpenRange(session, previousWeekStart, weekStart)));
  const weekSeconds = total(week);
  const weeklyChange = previousWeekSeconds > 0 ? Math.round((weekSeconds - previousWeekSeconds) / previousWeekSeconds * 100) : null;

  return {
    records, studyRecords,
    totals: { today: total(today), week: weekSeconds, month: total(month), all: allSeconds, averageDay: activeDays ? Math.round(allSeconds / activeDays) : 0 },
    counts: { completed, interrupted, completionRate: totalSessions ? Math.round(completed / totalSessions * 100) : 0 },
    subjects: subjects.map((item) => ({ ...item, percent: allSeconds ? Math.round(item.seconds / allSeconds * 100) : 0 })),
    mostStudiedSubject: subjectsWithData[0]?.name || null,
    leastStudiedSubject: subjectsWithData.length ? subjectsWithData[subjectsWithData.length - 1].name : null,
    chapters, topics, neglectedChapters,
    activities: activities.map((item) => ({ ...item, percent: allSeconds ? Math.round(item.seconds / allSeconds * 100) : 0 })),
    daily, weekly, monthly, productiveDay, weeklyChange
  };
}

export function formatFocusTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
