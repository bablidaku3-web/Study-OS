# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 1 — project foundation and dashboard

This branch initializes the Next.js + TypeScript + Tailwind application and responsive dashboard shell.

## Phase 2 — Smart Day Planner

The planner now supports editable study sessions with subject/chapter/topic, time range and priority; status tracking (planned, completed, partial, missed); session deletion and next-day rescheduling; a weekly calendar; daily checklist; separate to-do list; configurable study-hour goal; and a productivity summary derived from completed items. The data persists in this browser using localStorage. It is device-local and is not synced between browsers or accounts. Empty states are shown instead of fabricated activity analytics.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

The GitHub editing environment does not provide a Node.js runtime, so these commands must be run in a local checkout or CI environment.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS foundation and responsive custom styling
- Lucide icons
