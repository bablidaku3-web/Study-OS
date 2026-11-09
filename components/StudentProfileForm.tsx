"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, UserRound } from "lucide-react";
import {
  examPreparations,
  StudentProfile,
  studentClasses
} from "@/lib/data/studentProfileRepository";
import styles from "./student-profile.module.css";

type Props = {
  mode: "onboarding" | "settings";
  initialProfile?: StudentProfile | null;
  invalidStoredProfile?: boolean;
  onSave(profile: Omit<StudentProfile, "updatedAt">): void | Promise<void>;
};

export default function StudentProfileForm({ mode, initialProfile, invalidStoredProfile = false, onSave }: Props) {
  const [name, setName] = useState(initialProfile?.name ?? "");
  const [classLevel, setClassLevel] = useState<StudentProfile["classLevel"]>(initialProfile?.classLevel ?? "9");
  const [classOther, setClassOther] = useState(initialProfile?.classOther ?? "");
  const [examPreparation, setExamPreparation] = useState<StudentProfile["examPreparation"]>(initialProfile?.examPreparation ?? null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter the student's name.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        name: cleanName,
        classLevel,
        classOther: classLevel === "Other" ? classOther.trim() : "",
        examPreparation
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this profile.");
    } finally {
      setSaving(false);
    }
  }

  const isOnboarding = mode === "onboarding";

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.back}><ArrowLeft size={14} /> Dashboard</Link>
        <div className={styles.brand}><span>श</span> SHUNYA <small>STUDENT PROFILE</small></div>
        <span className={styles.localLabel}>Saved on this device</span>
      </header>
      <section className={styles.panel}>
        <div className={styles.mark}><UserRound size={18} /></div>
        <p className={styles.eyebrow}>{isOnboarding ? "YOUR STUDY SPACE" : "PERSONAL DETAILS"}</p>
        <h1>{isOnboarding ? "Let’s get started." : "Student profile"}</h1>
        <p className={styles.intro}>{isOnboarding
          ? "Tell us a little about your preparation. Your study records stay in this browser."
          : "Update the details shown in your study space. Your study records are not changed."}</p>
        {invalidStoredProfile && <p className={styles.notice} role="status">A saved profile could not be read. Your study data is unchanged; saving these details will replace only the profile.</p>}
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>Student name
            <input autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} required placeholder="Your name" />
          </label>
          <label className={styles.field}>Class
            <select value={classLevel} onChange={(event) => setClassLevel(event.target.value as StudentProfile["classLevel"])}>
              {studentClasses.map((item) => <option key={item} value={item}>{item === "Other" ? "Other" : item === "Dropper" ? "Dropper" : `Class ${item}`}</option>)}
            </select>
          </label>
          {classLevel === "Other" && <label className={styles.field}>Class or level <span>OPTIONAL</span>
            <input maxLength={50} value={classOther} onChange={(event) => setClassOther(event.target.value)} placeholder="Add a class or level" />
          </label>}
          <label className={styles.field}>Exam preparation <span>OPTIONAL</span>
            <select value={examPreparation ?? ""} onChange={(event) => setExamPreparation(event.target.value ? event.target.value as StudentProfile["examPreparation"] : null)}>
              <option value="">Choose later</option>
              {examPreparations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={styles.save} type="submit" disabled={saving}>
            <Check size={14} /> {saving ? "Saving…" : isOnboarding ? "Save and continue" : "Save profile"}
          </button>
        </form>
        {!isOnboarding && <p className={styles.footnote}>No login or cloud account is used. This profile is stored locally in this browser.</p>}
      </section>
    </main>
  );
}