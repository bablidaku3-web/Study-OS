export type FocusActivity = "Theory" | "Numericals" | "PYQs" | "Practice" | "Revision";
export type FocusSessionStatus = "completed" | "interrupted";

export type FocusSession = {
  id: string;
  mode: "pomodoro" | "custom";
  subject: string;
  chapter: string;
  topic: string;
  activity: FocusActivity;
  startedAt: string;
  endedAt: string;
  focusedSeconds: number;
  status: FocusSessionStatus;
};

/** Persistence boundary. Replace this adapter with Supabase without changing timer UI. */
export interface FocusSessionRepository {
  list(): Promise<FocusSession[]>;
  add(session: FocusSession): Promise<void>;
}

const STORAGE_KEY = "shunya-focus-sessions-v1";

function isFocusSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<FocusSession>;
  return typeof item.id === "string" && (item.mode === "pomodoro" || item.mode === "custom") &&
    typeof item.subject === "string" && typeof item.chapter === "string" && typeof item.topic === "string" &&
    typeof item.activity === "string" && typeof item.startedAt === "string" && typeof item.endedAt === "string" &&
    typeof item.focusedSeconds === "number" && Number.isFinite(item.focusedSeconds) && item.focusedSeconds >= 0 &&
    (item.status === "completed" || item.status === "interrupted");
}

class LocalFocusSessionRepository implements FocusSessionRepository {
  async list(): Promise<FocusSession[]> {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isFocusSession)) throw new Error("Invalid focus session records");
      return parsed;
    } catch {
      // Do not replace malformed user data: surface an error to the caller instead.
      throw new Error("Saved focus history could not be read. Existing data was left unchanged.");
    }
  }

  async add(session: FocusSession): Promise<void> {
    if (typeof window === "undefined") return;
    const existing = await this.list();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, session]));
  }
}

export const focusSessionRepository: FocusSessionRepository = new LocalFocusSessionRepository();
export const focusSessionStorageKey = STORAGE_KEY;
