"use client";

import { useEffect, useState } from "react";
import StudentProfileForm from "@/components/StudentProfileForm";
import {
  loadStudentProfile,
  saveStudentProfile,
  StudentProfile,
  StudentProfileLoadResult
} from "@/lib/data/studentProfileRepository";

export default function SettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [profileState, setProfileState] = useState<StudentProfileLoadResult>({ profile: null, invalid: false });
  const [savedProfile, setSavedProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const result = loadStudentProfile();
    setProfileState(result);
    setSavedProfile(result.profile);
    setLoaded(true);
  }, []);

  function save(input: Omit<StudentProfile, "updatedAt">) {
    const profile = saveStudentProfile(input);
    setSavedProfile(profile);
    setProfileState({ profile, invalid: false });
  }

  if (!loaded) return <main aria-label="Loading settings" />;

  return <StudentProfileForm
    mode="settings"
    initialProfile={savedProfile}
    invalidStoredProfile={profileState.invalid}
    onSave={save}
  />;
}