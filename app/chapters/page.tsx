"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, CircleHelp, Leaf, Plus, Search, ShieldAlert, Sparkles } from "lucide-react";
import { Chapter, chapterRepository, chapterSubjects, StudySubject, Zone } from "@/lib/data/chapterRepository";

const zoneLabel: Record<Zone, string> = { green: "Green zone", yellow: "Yellow zone", red: "Red zone" };
const zoneDescription: Record<Zone, string> = {
  green: "Confident and consistent. Keep it fresh with periodic revision.",
  yellow: "In progress. Revisit concepts and practice more questions.",
  red: "Needs attention. Rebuild concepts and work through mistakes."
};

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [subject, setSubject] = useState<StudySubject | "All">("All");
  const [zoneFilter, setZoneFilter] = useState<Zone | "all" | "unassessed">("all");
  const [query, setQuery] = useState("");
  const [customName, setCustomName] = useState("");
  const [customSubject, setCustomSubject] = useState<StudySubject>("Physics");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    chapterRepository.list().then(setChapters).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load chapters."))
      .finally(() => setReady(true));
  }, []);

  const filtered = useMemo(() => chapters.filter((chapter) => {
    const subjectMatch = subject === "All" || chapter.subject === subject;
    const zoneMatch = zoneFilter === "all" || (zoneFilter === "unassessed" ? chapter.zone === null : chapter.zone === zoneFilter);
    return subjectMatch && zoneMatch && chapter.name.toLowerCase().includes(query.trim().toLowerCase());
  }), [chapters, subject, zoneFilter, query]);

  const counts = useMemo(() => ({
    green: chapters.filter((chapter) => chapter.zone === "green").length,
    yellow: chapters.filter((chapter) => chapter.zone === "yellow").length,
    red: chapters.filter((chapter) => chapter.zone === "red").length,
    unassessed: chapters.filter((chapter) => chapter.zone === null).length
  }), [chapters]);

  async function persist(next: Chapter[]) {
    setChapters(next);
    try { await chapterRepository.save(next); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your changes."); }
  }
  function updateZone(chapter: Chapter, value: string) {
    const zone = value === "unassessed" ? null : value as Zone;
    const next = chapters.map((item) => item.id === chapter.id ? { ...item, zone, updatedAt: zone ? new Date().toISOString() : null } : item);
    void persist(next);
    setToast(zone ? `${chapter.name} moved to the ${zone} zone.` : `${chapter.name} marked as unassessed.`);
    window.setTimeout(() => setToast(""), 2400);
  }
  function addChapter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    if (chapters.some((chapter) => chapter.subject === customSubject && chapter.name.toLowerCase() === name.toLowerCase())) {
      setError("That chapter is already in this subject."); return;
    }
    const next = [...chapters, { id: crypto.randomUUID(), subject: customSubject, name, zone: null, updatedAt: null }];
    void persist(next); setCustomName(""); setError("");
  }

  return <main className="chapters-page">
    <header className="chapters-topbar"><Link href="/" className="back-link"><ArrowLeft size={15} /> Planner</Link><div className="chapter-brand"><span>श</span> SHUNYA <small>CHAPTER ZONES</small></div><div className="saved-indicator"><span /> Saved on this device</div></header>
    <div className="chapters-content">
      <div className="chapter-hero"><div><div className="chapter-eyebrow"><Sparkles size={12} /> YOUR SYLLABUS, AT A GLANCE</div><h1>Chapter management</h1><p>Track what feels strong, what needs practice, and where to focus next.</p></div><div className="chapter-count"><BookOpen size={16} /><span><b>{chapters.length}</b> chapters</span></div></div>
      <div className="zone-summary" aria-label="Chapter zone counts">
        <button className={`zone-summary-card green ${zoneFilter === "green" ? "chosen" : ""}`} onClick={() => setZoneFilter(zoneFilter === "green" ? "all" : "green")}><span className="zone-symbol"><Leaf size={15} /></span><span><b>{counts.green}</b><small>Green zone</small></span><i>Strong</i></button>
        <button className={`zone-summary-card yellow ${zoneFilter === "yellow" ? "chosen" : ""}`} onClick={() => setZoneFilter(zoneFilter === "yellow" ? "all" : "yellow")}><span className="zone-symbol"><CircleHelp size={15} /></span><span><b>{counts.yellow}</b><small>Yellow zone</small></span><i>In progress</i></button>
        <button className={`zone-summary-card red ${zoneFilter === "red" ? "chosen" : ""}`} onClick={() => setZoneFilter(zoneFilter === "red" ? "all" : "red")}><span className="zone-symbol"><ShieldAlert size={15} /></span><span><b>{counts.red}</b><small>Red zone</small></span><i>Priority</i></button>
      </div>
      <section className="chapter-controls card">
        <div className="subject-tabs" role="tablist" aria-label="Filter by subject">{(["All", ...chapterSubjects] as const).map((item) => <button key={item} role="tab" aria-selected={subject === item} className={subject === item ? "active" : ""} onClick={() => setSubject(item)}>{item}</button>)}</div>
        <div className="chapter-filters"><label className="chapter-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chapters" aria-label="Search chapters" /></label><label className="zone-select-label"><span className="sr-only">Filter chapter zones</span><select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value as Zone | "all" | "unassessed")}><option value="all">All zones</option><option value="unassessed">Unassessed</option><option value="green">Green zone</option><option value="yellow">Yellow zone</option><option value="red">Red zone</option></select><ChevronDown size={12} /></label></div>
      </section>
      <section className="chapter-list card"><div className="chapter-list-heading"><div><h2>{subject === "All" ? "All subjects" : subject}</h2><p>{filtered.length} chapters · zones can be updated manually</p></div><span className="unassessed-note">{counts.unassessed} to assess</span></div>
        {!ready ? <div className="chapter-empty">Loading your syllabus…</div> : filtered.length === 0 ? <div className="chapter-empty"><BookOpen size={20} /><b>No chapters match this view</b><span>Try another subject or zone filter.</span></div> : <div className="chapter-grid">{filtered.map((chapter) => <article className="chapter-card" key={chapter.id}><div className="chapter-card-top"><span className="chapter-subject">{chapter.subject}</span><span className={`zone-badge ${chapter.zone || "unassessed"}`}>{chapter.zone ? zoneLabel[chapter.zone] : "Unassessed"}</span></div><h3>{chapter.name}</h3><div className="chapter-card-foot"><span>{chapter.updatedAt ? `Updated ${new Date(chapter.updatedAt).toLocaleDateString()}` : "No performance data yet"}</span><label className="zone-picker"><span>Set zone</span><select aria-label={`Set zone for ${chapter.name}`} value={chapter.zone ?? "unassessed"} onChange={(event) => updateZone(chapter, event.target.value)}><option value="unassessed">Unassessed</option><option value="green">Green</option><option value="yellow">Yellow</option><option value="red">Red</option></select><ChevronDown size={11} /></label></div></article>)}</div>}
      </section>
      <section className="add-chapter-card card"><div><span className="add-chapter-icon"><Plus size={15} /></span><div><h2>Add a chapter</h2><p>Add syllabus chapters that aren&apos;t in the starter list.</p></div></div><form onSubmit={addChapter}><select aria-label="Subject for new chapter" value={customSubject} onChange={(event) => setCustomSubject(event.target.value as StudySubject)}>{chapterSubjects.map((name) => <option key={name}>{name}</option>)}</select><input aria-label="New chapter name" placeholder="Chapter name" maxLength={70} value={customName} onChange={(event) => setCustomName(event.target.value)} required /><button className="chapter-add-button" type="submit"><Plus size={13} /> Add chapter</button></form></section>
      <p className="chapter-disclaimer"><Check size={12} /> Zones start unassessed. Set them manually for now; performance-based recommendations will use real test data in later phases.</p>
      {error && <div className="chapter-error" role="alert">{error}</div>}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
  </main>;
}
