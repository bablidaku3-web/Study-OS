import { ExamCategory } from "./mistakeRepository";
export type FlashcardExam = "JEE Main" | "JEE Advanced" | "NEET UG";
export type RecallRating = "Again" | "Hard" | "Good" | "Easy";
export type FlashcardReview = { id: string; reviewedAt: string; rating: RecallRating; intervalDays: number };
export type Flashcard = {
  id: string;
  exam: FlashcardExam;
  subject: string;
  chapter: string;
  topic: string;
  front: string;
  back: string;
  difficulty: "Easy" | "Medium" | "Hard";
  bookmarked: boolean;
  sourceMistakeId: string | null;
  createdAt: string;
  updatedAt: string;
  nextReviewDate: string;
  reviewCount: number;
  consecutiveGood: number;
  reviews: FlashcardReview[];
};
export interface FlashcardRepository { list(): Promise<Flashcard[]>; add(card: Flashcard): Promise<void>; update(card: Flashcard): Promise<void>; remove(id: string): Promise<void>; }
export const FLASHCARD_STORAGE_KEY = "shunya-flashcards-v1";
const exams: FlashcardExam[] = ["JEE Main", "JEE Advanced", "NEET UG"];
const ratings: RecallRating[] = ["Again", "Hard", "Good", "Easy"];
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function isReview(value: unknown): value is FlashcardReview {
  if (!record(value)) return false;
  return typeof value.id === "string" && typeof value.reviewedAt === "string" && ratings.includes(value.rating as RecallRating) && typeof value.intervalDays === "number";
}
function isFlashcard(value: unknown): value is Flashcard {
  if (!record(value)) return false;
  return typeof value.id === "string" && exams.includes(value.exam as FlashcardExam) && typeof value.subject === "string" && typeof value.chapter === "string" &&
    typeof value.topic === "string" && typeof value.front === "string" && typeof value.back === "string" && ["Easy", "Medium", "Hard"].includes(String(value.difficulty)) &&
    typeof value.bookmarked === "boolean" && (value.sourceMistakeId === null || typeof value.sourceMistakeId === "string") && typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(value.nextReviewDate)) && typeof value.reviewCount === "number" &&
    typeof value.consecutiveGood === "number" && Array.isArray(value.reviews) && value.reviews.every(isReview);
}
export function localDayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function addFlashcardDays(dateKey: string, days: number) { const [y,m,d]=dateKey.split("-").map(Number); const date=new Date(y,m-1,d,12); date.setDate(date.getDate()+days); return localDayKey(date); }
export function nextRecallInterval(rating: RecallRating, count: number) {
  const base: Record<RecallRating, number> = { Again: 1, Hard: 2, Good: 4, Easy: 7 };
  const multiplier = Math.pow(1.7, Math.max(0, count));
  return Math.min(90, Math.max(1, Math.round(base[rating] * multiplier)));
}
class LocalFlashcardRepository implements FlashcardRepository {
  async list() {
    if (typeof window === "undefined") return [];
    const raw=window.localStorage.getItem(FLASHCARD_STORAGE_KEY); if(!raw)return [];
    try { const parsed:unknown=JSON.parse(raw); if(!Array.isArray(parsed)||!parsed.every(isFlashcard))throw new Error("Invalid flashcards"); return parsed; }
    catch { throw new Error("Saved flashcards could not be read. Existing data was left unchanged."); }
  }
  async add(card:Flashcard) {
    const cards=await this.list();
    if(cards.some((item)=>item.id===card.id||(card.sourceMistakeId&&item.sourceMistakeId===card.sourceMistakeId)))throw new Error("This flashcard or linked Mistake Vault entry already exists.");
    if(typeof window!=="undefined")window.localStorage.setItem(FLASHCARD_STORAGE_KEY,JSON.stringify([...cards,card]));
  }
  async update(card:Flashcard) {
    const cards=await this.list(); if(!cards.some((item)=>item.id===card.id))throw new Error("Flashcard not found.");
    if(typeof window!=="undefined")window.localStorage.setItem(FLASHCARD_STORAGE_KEY,JSON.stringify(cards.map((item)=>item.id===card.id?card:item)));
  }
  async remove(id:string) { const cards=await this.list(); if(typeof window!=="undefined")window.localStorage.setItem(FLASHCARD_STORAGE_KEY,JSON.stringify(cards.filter((item)=>item.id!==id))); }
}
export const flashcardRepository:FlashcardRepository=new LocalFlashcardRepository();
export const flashcardExams=exams;
export type { ExamCategory };
