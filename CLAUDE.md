# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TorreAdmin** is a SaaS platform for horizontal property management (condominiums/apartment buildings) in Latin America. It consists of a Next.js 14 frontend and a FastAPI Python backend deployed as Vercel Serverless Functions.

## Commands

```bash
# Frontend — run from frontend/
cd frontend
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm run lint      # ESLint (config: frontend/.eslintrc.json)

# Backend — run from repo root
pip install -r api/requirements.txt
uvicorn api.index:app --reload   # Local API server
```

No test suite exists yet.

## Architecture

### Frontend — `frontend/`

Next.js 14 App Router with TypeScript. The `frontend/` directory is the `rootDirectory` for Vercel. All protected routes live under `frontend/app/dashboard/`. The dashboard layout is a `"use client"` component that renders the sidebar and topbar. Individual feature pages are also client components.

> Note: there is an `app/` directory at the repo root — it is a stale copy/junction and is not used by the build.

**Data fetching:** Pages currently use mock data from `lib/mock-data.ts` directly — the real API integration (`lib/api.ts`) is not yet wired up to most UI components.

**API client:** `lib/api.ts` wraps `fetch` calls against `NEXT_PUBLIC_API_URL`. All backend requests go through this module.

**Styling:** Tailwind CSS with custom colors defined in `tailwind.config.ts`:
- Primary: `#1a5276` (dark blue)
- Secondary: `#2e86c1` (light blue)
- Accent: `#1e8449` (green)

**Path alias:** `@/` maps to the repo root (set in `tsconfig.json`).

### Backend — `api/`

FastAPI app in `api/index.py` (Vercel entry point). Routers are organized by domain in `api/routers/`:

| Router | Domain |
|---|---|
| `edificios.py` | Buildings/properties |
| `usuarios.py` | Users/residents |
| `cuotas.py` | Financial quotas |
| `mantenimientos.py` | Maintenance requests |
| `comunicados.py` | Announcements |
| `zonas_comunes.py` | Common area reservations |
| `accesos.py` | Visitor access logs |
| `paquetes.py` | Package tracking |
| `guardias.py` | Security shifts |
| `chat.py` | Guard messaging |
| `reportes.py` | Analytics/exports |

**Database:** PostgreSQL via `psycopg2` with raw SQL and `RealDictCursor`. No ORM. The full schema (11+ tables) is defined in `api/db.py` and seeded via `seed_db()` on startup. Use a context manager pattern for connections with auto-rollback on error.

**Key tables:** `edificios` → `unidades` → `usuarios`/`ocupaciones`. Main business entities: `cuotas`, `mantenimientos`, `comunicados`, `visitantes`, `paquetes`, `guardias`, `mensajes`.

**User roles** (DB check constraint): `administrador`, `propietario`, `inquilino`, `portero`.

Soft deletes are used throughout (boolean `activo` column) rather than hard deletes.

### Deployment — Vercel

`vercel.json` routes all `/api/*` requests to `api/index.py` (Python 3.12, 30s max duration). The Next.js frontend and FastAPI backend are deployed together on Vercel.

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend | Base URL for API calls in `lib/api.ts` |
| `DATABASE_URL` | Backend | PostgreSQL connection string |

## Current State / Known Gaps

- **No authentication** implemented (POC stage) — CORS is open (`*`)
- **Frontend uses mock data** — `lib/mock-data.ts` is the data source for most pages, not the live API
- **No tests** — neither frontend nor backend has a test suite
