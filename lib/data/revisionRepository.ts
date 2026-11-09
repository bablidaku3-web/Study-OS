import { Chapter } from "./chapterRepository";
import { ExamCategory, MistakeRecord } from "./mistakeRepository";
import { TestAttempt } from "./testRepository";

export type RevisionStatus = "active" | "completed";
export type RevisionEvent = {
  id: string;
  action: "completed" | "skipped" | "rescheduled" | "flashcard-review";
  date: string;
  durationMinutes: number;
  note: string;
};
export type RevisionSchedule = {
  id: string;
  exam: ExamCategory;
  subject: string;
  chapter: string;
  topic: string;
  intervals: number[];
  completedCount: number;
  nextDueDate: string | null;
  status: RevisionStatus;
  linkedMistakeIds: string[];
  createdAt: string;
  updatedAt: string;
  history: RevisionEvent[];
};
export interface RevisionRepository {
  list(): Promise<RevisionSchedule[]>;
  add(schedule: RevisionSchedule): Promise<void>;
  update(schedule: RevisionSchedule): Promise<void>;
}

const STORAGE_KEY = "shunya-revision-schedules-v1";
export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 14, 30];
const examValues: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isEvent(value: unknown): value is RevisionEvent {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && ["completed", "skipped", "rescheduled", "flashcard-review"].includes(String(value.action)) &&
    typeof value.date === "string" && typeof value.durationMinutes === "number" && typeof value.note === "string";
}
function isSchedule(value: unknown): value is RevisionSchedule {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && examValues.includes(value.exam as ExamCategory) && typeof value.subject === "string" &&
    typeof value.chapter === "string" && typeof value.topic === "string" && Array.isArray(value.intervals) &&
    value.intervals.every((day) => typeof day === "number" && Number.isInteger(day) && day > 0) &&
    typeof value.completedCount === "number" && Number.isInteger(value.completedCount) && value.completedCount >= 0 &&
    (value.nextDueDate === null || (typeof value.nextDueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.nextDueDate))) &&
    (value.status === "active" || value.status === "completed") && Array.isArray(value.linkedMistakeIds) &&
    value.linkedMistakeIds.every((id) => typeof id === "string") && typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" && Array.isArray(value.history) && value.history.every(isEvent);
}
function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
export function todayLocalDate() { return localDateKey(new Date()); }
export function sortRevisionSchedules(schedules: RevisionSchedule[]) {
  return [...schedules].sort((a, b) => (a.nextDueDate || "9999-12-31").localeCompare(b.nextDueDate || "9999-12-31"));
}
export function suggestRevisionSchedules(schedules: RevisionSchedule[], chapters: Chapter[], mistakes: MistakeRecord[], attempts: TestAttempt[]) {
  const existing = new Set(schedules.filter((item) => item.status === "active").map((item) => `${item.exam}|${item.subject.toLowerCase()}|${item.chapter.toLowerCase()}`));
  const submittedAttemptIds = new Set(attempts.filter((attempt) => !!attempt.submittedAt).map((attempt) => attempt.id));
  const suggestions: { exam: ExamCategory; subject: string; chapter: string; topic: string; mistakeIds: string[]; reason: string }[] = [];
  const unresolved = mistakes.filter((item) => item.status !== "Resolved" && (!item.attemptId || submittedAttemptIds.has(item.attemptId)));
  unresolved.forEach((mistake) => {
    const exam = mistake.exam;
    const key = `${exam}|${mistake.subject.toLowerCase()}|${mistake.chapter.toLowerCase()}`;
    const previous = suggestions.find((item) => `${item.exam}|${item.subject.toLowerCase()}|${item.chapter.toLowerCase()}` === key);
    if (previous) { previous.mistakeIds.push(mistake.id); return; }
    if (!existing.has(key)) suggestions.push({ exam, subject: mistake.subject, chapter: mistake.chapter, topic: mistake.topic, mistakeIds: [mistake.id], reason: "Unresolved Mistake Vault entry" });
  });
  chapters.filter((chapter) => chapter.zone === "red" || chapter.zone === "yellow").forEach((chapter) => {
    const exam: ExamCategory = chapter.subject === "Biology" ? "NEET" : "JEE";
    const key = `${exam}|${chapter.subject.toLowerCase()}|${chapter.name.toLowerCase()}`;
    if (!existing.has(key) && !suggestions.some((item) => `${item.exam}|${item.subject.toLowerCase()}|${item.chapter.toLowerCase()}` === key)) {
      suggestions.push({ exam, subject: chapter.subject, chapter: chapter.name, topic: "", mistakeIds: [], reason: `${chapter.zone === "red" ? "Red" : "Yellow"} chapter zone` });
    }
  });
  return suggestions;
}

class LocalRevisionRepository implements RevisionRepository {
  async list() {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isSchedule)) throw new Error("Invalid revision schedules");
      return parsed;
    } catch { throw new Error("Saved revision data could not be read. Existing data was left unchanged."); }
  }
  async add(schedule: RevisionSchedule) {
    const schedules = await this.list();
    if (schedules.some((item) => item.status === "active" && schedule.status === "active" && item.exam === schedule.exam && item.subject.toLowerCase() === schedule.subject.toLowerCase() && item.chapter.toLowerCase() === schedule.chapter.toLowerCase())) {
      throw new Error("An active revision schedule already exists for this chapter and exam.");
    }
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...schedules, schedule]));
  }
  async update(schedule: RevisionSchedule) {
    const schedules = await this.list();
    if (!schedules.some((item) => item.id === schedule.id)) throw new Error("Revision schedule was not found.");
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules.map((item) => item.id === schedule.id ? schedule : item)));
  }
}
export const revisionRepository: RevisionRepository = new LocalRevisionRepository();
export const revisionStorageKey = STORAGE_KEY;
