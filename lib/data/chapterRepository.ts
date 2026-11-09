export type StudySubject = "Physics" | "Chemistry" | "Mathematics" | "Biology";
export type Zone = "green" | "yellow" | "red";

export type Chapter = {
  id: string;
  subject: StudySubject;
  name: string;
  zone: Zone | null;
  updatedAt: string | null;
};

/** Repository boundary keeps UI independent from localStorage/Supabase details. */
export interface ChapterRepository {
  list(): Promise<Chapter[]>;
  save(chapters: Chapter[]): Promise<void>;
}

const STORAGE_KEY = "shunya-chapters-v1";

const syllabus: Record<StudySubject, string[]> = {
  Physics: ["Units and Measurements", "Motion in a Straight Line", "Laws of Motion", "Work, Energy and Power", "Rotational Motion", "Gravitation", "Thermodynamics", "Oscillations", "Waves", "Electrostatics", "Current Electricity", "Magnetism", "Electromagnetic Induction", "Optics", "Modern Physics"],
  Chemistry: ["Some Basic Concepts", "Atomic Structure", "Chemical Bonding", "Thermodynamics", "Equilibrium", "Redox Reactions", "Solutions", "Electrochemistry", "Chemical Kinetics", "Periodic Table", "Organic Chemistry Basics", "Hydrocarbons", "Coordination Compounds", "Biomolecules"],
  Mathematics: ["Sets and Functions", "Complex Numbers", "Quadratic Equations", "Sequences and Series", "Permutations and Combinations", "Binomial Theorem", "Limits and Continuity", "Differentiation", "Applications of Derivatives", "Indefinite Integration", "Definite Integration", "Differential Equations", "Coordinate Geometry", "Vectors and 3D Geometry", "Probability"],
  Biology: ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Cell Structure and Function", "Plant Physiology", "Human Physiology", "Reproduction", "Genetics and Evolution", "Biology and Human Welfare", "Biotechnology", "Ecology and Environment"]
};

function isSubject(value: unknown): value is StudySubject {
  return value === "Physics" || value === "Chemistry" || value === "Mathematics" || value === "Biology";
}
function isZone(value: unknown): value is Zone | null {
  return value === null || value === "green" || value === "yellow" || value === "red";
}
function validChapter(value: unknown): value is Chapter {
  if (!value || typeof value !== "object") return false;
  const chapter = value as Partial<Chapter>;
  return typeof chapter.id === "string" && isSubject(chapter.subject) &&
    typeof chapter.name === "string" && isZone(chapter.zone) &&
    (chapter.updatedAt === null || typeof chapter.updatedAt === "string");
}

function makeInitialSyllabus(): Chapter[] {
  return (Object.entries(syllabus) as [StudySubject, string[]][]).flatMap(([subject, names]) =>
    names.map((name) => ({
      id: `${subject.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`,
      subject,
      name,
      zone: null,
      updatedAt: null
    }))
  );
}

class LocalChapterRepository implements ChapterRepository {
  async list(): Promise<Chapter[]> {
    if (typeof window === "undefined") return makeInitialSyllabus();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initial = makeInitialSyllabus();
      await this.save(initial);
      return initial;
    }
    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(validChapter)) throw new Error("Invalid chapter data");
      return parsed;
    } catch {
      // Preserve the original value for recovery; do not silently overwrite user data.
      throw new Error("Saved chapter data could not be read. Your stored data was left unchanged.");
    }
  }

  async save(chapters: Chapter[]): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
  }
}

export const chapterRepository: ChapterRepository = new LocalChapterRepository();
export const chapterSubjects = Object.keys(syllabus) as StudySubject[];
