# CLAUDE.md - Project Instructions

## Project Overview

Qualitative coding canvas for researchers. React 18 + Vite frontend, Express + Prisma + PostgreSQL backend. Monorepo with shared types package.

## Rules

- **Never use `killall`** — do not use the `killall` command under any circumstances.

## Commands

- `npm install` then `npm run db:migrate` then `npm run db:seed` then `npm run dev`
- `npm test` — run all 282 tests (238 unit + 44 E2E)
- `npm run test:e2e` — run 44 Playwright E2E tests (set `E2E_TEST=true` env var for test mode)
- `npm run typecheck` — type-check backend + frontend
- `npm run lint` — ESLint across all packages
- `npm run build` — full production build
- Demo login: CANVAS-DEMO2025

## Ports

- Backend: `http://localhost:3007`
- Frontend: `http://localhost:5174`

## Key Paths

- Backend entry: `apps/backend/src/index.ts`
- Frontend entry: `apps/frontend/src/main.tsx`
- Canvas workspace: `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas store: `apps/frontend/src/stores/canvasStore.ts`
- Route modules: `apps/backend/src/routes/` (20 files)
- Prisma schema: `apps/backend/prisma/schema.prisma` (32 models)
- Shared types: `shared/types/canvas.types.ts`
