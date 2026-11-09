# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 1 — project foundation and dashboard

This branch initializes the Next.js + TypeScript + Tailwind application and responsive dashboard shell.

## Phase 2 — Smart Day Planner

The planner supports editable sessions, task status, rescheduling, a weekly calendar, daily checklist, separate To-do list, and a configurable daily goal. It persists under the existing `shunya-planner-v1` browser localStorage key. Chapter-management work uses a separate storage key and does not rewrite or migrate planner data.

## Phase 3 — Chapter Management foundation

Visit `/chapters` for subject-wise Physics, Chemistry, Mathematics, and Biology chapter lists. Chapters start **Unassessed** (not assigned fabricated performance values). Students can manually set Green, Yellow, or Red zones, filter/search chapters, and add custom chapters. The data access layer is behind a `ChapterRepository` interface and currently uses its own versioned localStorage key, `shunya-chapters-v1`, so it can later be replaced with a Supabase implementation independently of the planner.

Automatic performance scoring, topic-level tracking, and test-driven zone updates are not part of this initial chapter-page task yet.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

The GitHub editing environment does not provide a Node.js runtime, so I cannot execute these commands from the repository editor. Run them in a local checkout or CI environment.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS foundation and responsive custom styling
- Lucide icons
