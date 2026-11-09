export const STUDENT_PROFILE_STORAGE_KEY = "shunya-student-profile-v1";

export const studentClasses = ["9", "10", "11", "12", "Dropper", "Other"] as const;
export const examPreparations = ["JEE", "NEET", "Other / Not preparing"] as const;

export type StudentClass = typeof studentClasses[number];
export type ExamPreparation = typeof examPreparations[number];
export type StudentProfile = {
  name: string;
  classLevel: StudentClass;
  classOther: string;
  examPreparation: ExamPreparation | null;
  updatedAt: string;
};

export type StudentProfileLoadResult = {
  profile: StudentProfile | null;
  invalid: boolean;
};

function isStudentProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const profile = value as Partial<StudentProfile>;
  return typeof profile.name === "string" && profile.name.trim().length > 0 &&
    studentClasses.includes(profile.classLevel as StudentClass) &&
    typeof profile.classOther === "string" &&
    (profile.examPreparation === null || examPreparations.includes(profile.examPreparation as ExamPreparation)) &&
    typeof profile.updatedAt === "string";
}

export function loadStudentProfile(): StudentProfileLoadResult {
  if (typeof window === "undefined") return { profile: null, invalid: false };

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
  } catch {
    return { profile: null, invalid: true };
  }
  if (raw === null) return { profile: null, invalid: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    return isStudentProfile(parsed)
      ? { profile: parsed, invalid: false }
      : { profile: null, invalid: true };
  } catch {
    return { profile: null, invalid: true };
  }
}

export function saveStudentProfile(input: Omit<StudentProfile, "updatedAt">): StudentProfile {
  const profile: StudentProfile = { ...input, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}