# SHUNYA — AI StudyOS

A calm, focused study workspace for JEE and NEET preparation.

## Phase 1: project foundation and dashboard

This branch initializes the Next.js + TypeScript + Tailwind application and includes a responsive dark-first dashboard preview. The dashboard currently uses clearly labeled sample preview data; it is not connected to a student account or database yet. Authentication and persistent profiles are planned for the next implementation phase.

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

## Stack

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- Lucide icons

## Current scope

- Responsive dashboard shell with dark/light theme toggle
- Study navigation and mobile menu
- Preview metric cards, focus-hours chart, chapter-zone overview, and today's plan
- Accessible button labels and status feedback

Planner, persistence, authentication, and real student analytics are not implemented in Phase 1. Preview values are intentionally marked as example data and must not be interpreted as a student's real results.
