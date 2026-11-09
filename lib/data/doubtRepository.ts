import { ExamCategory } from "./mistakeRepository";

export type DoubtMode = "Explain Simply" | "Step-by-Step Solution" | "Concept Explanation" | "Shortcut Method" | "Similar Practice Questions";
export type DoubtRecord = {
  id: string;
  exam: ExamCategory;
  subject: string;
  chapter: string;
  topic: string;
  mode: DoubtMode;
  question: string;
  answer: string;
  model: string;
  createdAt: string;
  imageName: string | null;
};
export interface DoubtRepository {
  list(): Promise<DoubtRecord[]>;
  add(record: DoubtRecord): Promise<void>;
  remove(id: string): Promise<void>;
}
const STORAGE_KEY = "shunya-doubt-history-v1";
const exams: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];
const modes: DoubtMode[] = ["Explain Simply", "Step-by-Step Solution", "Concept Explanation", "Shortcut Method", "Similar Practice Questions"];
function validRecord(value: unknown): value is DoubtRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DoubtRecord>;
  return typeof item.id === "string" && exams.includes(item.exam as ExamCategory) && typeof item.subject === "string" &&
    typeof item.chapter === "string" && typeof item.topic === "string" && modes.includes(item.mode as DoubtMode) &&
    typeof item.question === "string" && typeof item.answer === "string" && typeof item.model === "string" &&
    typeof item.createdAt === "string" && (item.imageName === null || typeof item.imageName === "string");
}
class LocalDoubtRepository implements DoubtRepository {
  async list() {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(validRecord)) throw new Error("Invalid doubt history");
      return parsed;
    } catch { throw new Error("Saved doubt history could not be read. Existing data was left unchanged."); }
  }
  async add(record: DoubtRecord) {
    const records = await this.list();
    if (records.some((item) => item.id === record.id)) throw new Error("This doubt is already saved.");
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...records, record]));
  }
  async remove(id: string) {
    const records = await this.list();
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.filter((item) => item.id !== id)));
  }
}
export const doubtRepository: DoubtRepository = new LocalDoubtRepository();
export const doubtStorageKey = STORAGE_KEY;
