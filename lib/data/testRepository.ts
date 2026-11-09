export type ExamType = "JEE Main" | "JEE Advanced" | "NEET UG";
export type QuestionType = "MCQ" | "Multiple Correct" | "Numerical";
export type TestQuestion = {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string | string[];
  positiveMarks: number;
  negativeMarks: number;
  explanation: string;
};
export type StudyTest = {
  id: string;
  title: string;
  exam: ExamType;
  subjects: string[];
  durationMinutes: number;
  totalMarks: number;
  createdAt: string;
  questions: TestQuestion[];
};
export type TestAnswer = { value: string | string[]; visitedAt: string; secondsSpent: number };
export type TestResult = {
  totalMarks: number;
  marksObtained: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  subjectScores: { subject: string; marks: number; total: number; correct: number; incorrect: number }[];
  chapterScores: { subject: string; chapter: string; marks: number; total: number; correct: number; incorrect: number }[];
  timePerQuestion: { questionId: string; seconds: number }[];
};
export type TestAttempt = {
  id: string;
  testId: string;
  startedAt: string;
  updatedAt: string;
  currentQuestion: number;
  answers: Record<string, TestAnswer>;
  markedForReview: string[];
  submittedAt: string | null;
  result: TestResult | null;
};
export interface TestRepository {
  listTests(): Promise<StudyTest[]>;
  listAttempts(): Promise<TestAttempt[]>;
  getTest(id: string): Promise<StudyTest | null>;
  createTest(test: StudyTest): Promise<void>;
  getAttempt(testId: string): Promise<TestAttempt | null>;
  saveAttempt(attempt: TestAttempt): Promise<void>;
}
const TESTS_KEY = "shunya-tests-v1";
const ATTEMPTS_KEY = "shunya-test-attempts-v1";
const exams: ExamType[] = ["JEE Main", "JEE Advanced", "NEET UG"];
const types: QuestionType[] = ["MCQ", "Multiple Correct", "Numerical"];
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isQuestion(value: unknown): value is TestQuestion {
  if (!record(value)) return false;
  return typeof value.id === "string" && typeof value.subject === "string" && typeof value.chapter === "string" &&
    typeof value.topic === "string" && types.includes(value.type as QuestionType) && typeof value.prompt === "string" &&
    Array.isArray(value.options) && value.options.every((option) => typeof option === "string") &&
    (typeof value.correctAnswer === "string" || Array.isArray(value.correctAnswer)) &&
    typeof value.positiveMarks === "number" && typeof value.negativeMarks === "number" && typeof value.explanation === "string";
}
function isTest(value: unknown): value is StudyTest {
  if (!record(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" && exams.includes(value.exam as ExamType) &&
    Array.isArray(value.subjects) && typeof value.durationMinutes === "number" && typeof value.totalMarks === "number" &&
    typeof value.createdAt === "string" && Array.isArray(value.questions) && value.questions.every(isQuestion);
}
function safeRead<T>(key: string, validator: (value: unknown) => value is T): T[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validator)) throw new Error("invalid saved data");
    return parsed;
  } catch {
    throw new Error(`Saved test data (${key}) could not be read; existing data was not changed.`);
  }
}
function isAttempt(value: unknown): value is TestAttempt {
  if (!record(value)) return false;
  return typeof value.id === "string" && typeof value.testId === "string" && typeof value.startedAt === "string" &&
    typeof value.updatedAt === "string" && typeof value.currentQuestion === "number" && record(value.answers) &&
    Array.isArray(value.markedForReview) && (value.submittedAt === null || typeof value.submittedAt === "string") &&
    (value.result === null || record(value.result));
}
class LocalTestRepository implements TestRepository {
  async listTests() { return safeRead(TESTS_KEY, isTest); }
  async listAttempts() { return safeRead(ATTEMPTS_KEY, isAttempt); }
  async getTest(id: string) { return (await this.listTests()).find((test) => test.id === id) || null; }
  async createTest(test: StudyTest) {
    const existing = await this.listTests();
    if (existing.some((item) => item.id === test.id)) throw new Error("This test already exists.");
    if (typeof window !== "undefined") window.localStorage.setItem(TESTS_KEY, JSON.stringify([...existing, test]));
  }
  async getAttempt(testId: string) { return safeRead(ATTEMPTS_KEY, isAttempt).find((attempt) => attempt.testId === testId) || null; }
  async saveAttempt(attempt: TestAttempt) {
    const existing = safeRead(ATTEMPTS_KEY, isAttempt);
    const index = existing.findIndex((item) => item.testId === attempt.testId);
    if (index >= 0 && existing[index].submittedAt) throw new Error("This test has already been submitted and cannot be changed.");
    const next = index >= 0 ? existing.map((item, i) => i === index ? attempt : item) : [...existing, attempt];
    if (typeof window !== "undefined") window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
  }
}
export const testRepository: TestRepository = new LocalTestRepository();
