import { FocusSession } from "./focusSessionRepository";

export type FocusPeriod = "day" | "week" | "month";
export type FocusFilter = { from?: string; to?: string; subject?: string; activity?: string };
export const ANALYTICS_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;
export const ANALYTICS_ACTIVITIES = ["Theory", "Numericals", "PYQs", "Practice", "Revision"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
function localDateKey(date: Date) {
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

/** Deduplicate by stable session id; only positive active-focus records count as study. */
export function uniqueFocusSessions(sessions: FocusSession[]) {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (!session.id || seen.has(session.id)) return false;
    seen.add(session.id);
    return session.focusedSeconds > 0 && Number.isFinite(session.focusedSeconds);
  });
}

export function filterFocusSessions(sessions: FocusSession[], filters: FocusFilter) {
  return sessions.filter((session) => {
    const date = parseDate(session.startedAt);
    if (!date) return false;
    const key = localDateKey(date);
    if (filters.from && key < filters.from) return false;
    if (filters.to && key > filters.to) return false;
    if (filters.subject && session.subject !== filters.subject) return false;
    if (filters.activity && session.activity !== filters.activity) return false;
    return true;
  });
}

export function buildAnalytics(sessions: FocusSession[], reference = new Date()) {
  const records = uniqueFocusSessions(sessions);
  const todayKey = localDateKey(reference);
  const todayStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const weekStart = startOfWeek(reference);
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const inRange = (session: FocusSession, start: Date, end = reference) => {
    const date = parseDate(session.startedAt);
    return !!date && date >= start && date <= end;
  };
  const today = records.filter((session) => localDateKey(parseDate(session.startedAt)!) === todayKey);
  const week = records.filter((session) => inRange(session, weekStart));
  const month = records.filter((session) => inRange(session, monthStart));
  const total = (list: FocusSession[]) => list.reduce((sum, item) => sum + item.focusedSeconds, 0);
  const completed = records.filter((session) => session.status === "completed").length;
  const interrupted = records.filter((session) => session.status === "interrupted").length;
  const totalSessions = completed + interrupted;
  const dailyMap = new Map<string, number>();
  records.forEach((session) => {
    const date = parseDate(session.startedAt);
    if (!date) return;
    const key = localDateKey(date);
    dailyMap.set(key, (dailyMap.get(key) || 0) + session.focusedSeconds);
  });
  const subjects = ANALYTICS_SUBJECTS.map((name) => ({
    name,
    seconds: total(records.filter((session) => session.subject === name))
  }));
  const subjectsWithData = subjects.filter((item) => item.seconds > 0);
  const rankedSubjects = [...subjectsWithData].sort((a, b) => b.seconds - a.seconds);
  const groupBy = (key: (session: FocusSession) => string, unknownLabel: string) => {
    const map = new Map<string, number>();
    records.forEach((session) => {
      const name = key(session).trim() || unknownLabel;
      map.set(name, (map.get(name) || 0) + session.focusedSeconds);
    });
    return [...map.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds);
  };
  const chapters = groupBy((session) => session.chapter, "Unspecified chapter");
  const topics = groupBy((session) => session.topic, "Unspecified topic");
  const activities = ANALYTICS_ACTIVITIES.map((name) => ({
    name,
    seconds: total(records.filter((session) => session.activity === name))
  }));
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * DAY_MS);
    const key = localDateKey(date);
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), key, seconds: dailyMap.get(key) || 0 };
  });
  const weekly = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(weekStart.getTime() - (3 - index) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    return { label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), key: localDateKey(start), seconds: total(records.filter((session) => inRange(session, start, end))) };
  });
  const daysInMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const monthly = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth(), index + 1);
    const key = localDateKey(date);
    return { label: String(index + 1), key, seconds: dailyMap.get(key) || 0 };
  });
  const activeDays = new Set(records.map((session) => {
    const date = parseDate(session.startedAt);
    return date ? localDateKey(date) : "";
  }).filter(Boolean)).size;
  const productiveDay = [...daily].filter((day) => day.seconds > 0).sort((a, b) => b.seconds - a.seconds)[0] || null;
  const previousWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const previousWeekSeconds = total(records.filter((session) => inRange(session, previousWeekStart, new Date(weekStart.getTime() - 1))));
  const weekSeconds = total(week);
  const weeklyChange = previousWeekSeconds > 0 ? Math.round((weekSeconds - previousWeekSeconds) / previousWeekSeconds * 100) : null;

  return {
    records,
    totals: { today: total(today), week: weekSeconds, month: total(month), all: total(records), averageDay: activeDays ? Math.round(total(records) / activeDays) : 0 },
    counts: { completed, interrupted, completionRate: totalSessions ? Math.round(completed / totalSessions * 100) : 0 },
    subjects: subjects.map((item) => ({ ...item, percent: total(records) ? Math.round(item.seconds / total(records) * 100) : 0 })),
    mostStudiedSubject: rankedSubjects[0]?.name || null,
    leastStudiedSubject: rankedSubjects.length ? rankedSubjects[rankedSubjects.length - 1].name : null,
    chapters,
    topics,
    activities: activities.map((item) => ({ ...item, percent: total(records) ? Math.round(item.seconds / total(records) * 100) : 0 })),
    daily,
    weekly,
    monthly,
    productiveDay,
    weeklyChange
  };
}

export function formatFocusTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
