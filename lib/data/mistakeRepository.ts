export type ExamCategory = "JEE" | "NEET" | "CA" | "UPSC";
export type MistakeCategory = "Conceptual" | "Calculation" | "Silly Mistake" | "Time Management" | "Memory/Recall";
export type MistakeStatus = "Needs Review" | "Revised" | "Resolved";

export type MistakeRecord = {
  id: string;
  exam: ExamCategory;
  subject: string;
  chapter: string;
  topic: string;
  category: MistakeCategory;
  status: MistakeStatus;
  question: string;
  studentAnswer: string;
  explanation: string;
  correctApproach: string;
  source: "manual" | "mock-test";
  testId: string | null;
  attemptId: string | null;
  questionId: string | null;
  testTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface MistakeRepository {
  list(): Promise<MistakeRecord[]>;
  add(mistake: MistakeRecord): Promise<void>;
  update(mistake: MistakeRecord): Promise<void>;
}

const STORAGE_KEY = "shunya-mistake-vault-v1";
const categories: MistakeCategory[] = ["Conceptual", "Calculation", "Silly Mistake", "Time Management", "Memory/Recall"];
const statuses: MistakeStatus[] = ["Needs Review", "Revised", "Resolved"];
const exams: ExamCategory[] = ["JEE", "NEET", "CA", "UPSC"];

function isMistake(value: unknown): value is MistakeRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MistakeRecord>;
  return typeof item.id === "string" && exams.includes(item.exam as ExamCategory) && typeof item.subject === "string" &&
    typeof item.chapter === "string" && typeof item.topic === "string" && categories.includes(item.category as MistakeCategory) &&
    statuses.includes(item.status as MistakeStatus) && typeof item.question === "string" && typeof item.studentAnswer === "string" &&
    typeof item.explanation === "string" && typeof item.correctApproach === "string" &&
    (item.source === "manual" || item.source === "mock-test") &&
    (item.testId === null || typeof item.testId === "string") && (item.attemptId === null || typeof item.attemptId === "string") &&
    (item.questionId === null || typeof item.questionId === "string") && (item.testTitle === null || typeof item.testTitle === "string") &&
    typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

class LocalMistakeRepository implements MistakeRepository {
  async list() {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isMistake)) throw new Error("Invalid saved mistakes");
      return parsed;
    } catch {
      throw new Error("Saved Mistake Vault data could not be read. Existing data was left unchanged.");
    }
  }
  async add(mistake: MistakeRecord) {
    const items = await this.list();
    if (items.some((item) => item.id === mistake.id || (mistake.attemptId && mistake.questionId && item.attemptId === mistake.attemptId && item.questionId === mistake.questionId))) {
      throw new Error("This mistake is already recorded in the vault.");
    }
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...items, mistake]));
  }
  async update(mistake: MistakeRecord) {
    const items = await this.list();
    if (!items.some((item) => item.id === mistake.id)) throw new Error("Mistake was not found.");
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((item) => item.id === mistake.id ? mistake : item)));
  }
}
export const mistakeRepository: MistakeRepository = new LocalMistakeRepository();
export const mistakeStorageKey = STORAGE_KEY;
