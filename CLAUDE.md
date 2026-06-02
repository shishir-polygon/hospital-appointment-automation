# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An AI-powered voice booking platform for hospitals. Patients speak in Bengali, English, or Hindi and the system books doctor appointments, checks queue status, and provides doctor info — all in real time from the database.

## Architecture

```
Browser (voice UI @ :8001)
       │ audio / text
       ▼
AI Service  :8001   Python / FastAPI
       │ direct SQL (psycopg2)         ← bypasses Laravel for speed
       ▼
PostgreSQL  :5433   Docker
       ▲
       │ migrations + seeders
Laravel Backend  :8000  PHP 8.3 / Laravel 11
       ▲
       │ JWT auth
Next.js Admin  :3000   React 19 / Next.js 15
```

Five Docker services: `postgres`, `redis`, `backend`, `ai-service`, `frontend`. Nginx reverse proxy at `:8080`.

## Running the system

**Full Docker stack (recommended):**
```bash
bash run.sh           # start everything + run migrations
bash run.sh --fresh   # same but drop and re-seed DB
```

**Development mode (AI service with hot-reload):**
```bash
docker compose up -d postgres redis           # infra only
cd backend && php artisan migrate:fresh --seed --force
cd ai-service && python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
cd frontend && npm run dev
```

**Database access:**
```bash
docker exec -it ai_doctor_postgres psql -U postgres -d ai_doctor
```

**Container logs:**
```bash
docker compose logs -f ai-service
docker compose logs -f backend
```

## Service URLs and credentials

| Service | URL |
|---------|-----|
| Voice demo UI | http://localhost:8001 |
| Admin panel | http://localhost:3000 |
| Backend API | http://localhost:8000/api/v1 |
| Nginx proxy | http://localhost:8080 |

Admin logins: `admin@hospital.com` / `password` (super admin), `hospitaladmin@demo.com` / `password` (hospital admin).

DB: `localhost:5433`, database `ai_doctor`, user `postgres`, password `secret`.

## Required environment variables

Copy `.env.example` to `.env` and fill in:
- `GROQ_API_KEY` — from console.groq.com (free tier works)
- `APP_KEY` — generate with `php artisan key:generate`
- `JWT_SECRET` — any random string

## AI Service architecture

**`ai-service/`** — the core intelligence layer.

- `main.py` — FastAPI app, HTTP endpoints, session wiring
- `services/conversation_manager.py` — state machine, DB context fetching, appointment creation
- `services/groq_service.py` — all Groq API calls (STT, LLM intent detection, field extraction, response generation)
- `services/db_service.py` — raw psycopg2 queries for doctors, queue, slots, appointments
- `services/tts_service.py` — edge-tts text-to-speech (Microsoft Neural voices)
- `models/conversation.py` — Pydantic models: `ConversationSession`, `BookingStage`, `ConversationIntent`, `BookingData`
- `config.py` — settings via pydantic-settings / `.env`

**Conversation state machine** (`BookingStage` enum):
```
GREETING → INTENT_DETECTION → DOCTOR_SELECTION → DATE_SELECTION → PATIENT_INFO → CONFIRMATION → COMPLETED
```

Each turn in `conversation_manager.process_turn()`:
1. Single LLM call: detect intent + extract booking fields together (first turn only)
2. Subsequent turns: field extraction only (8B model, saves API quota)
3. Fetch real-time context from DB (doctor info, queue, slots)
4. Re-compute booking stage based on what's still missing
5. Generate response (70B primary, falls back to 8B on rate limit)
6. On confirmation + "yes" word → write appointment directly via `db_service.create_appointment()`

**Groq model strategy:**
- `llm_fast_model` = `llama-3.1-8b-instant` — used for intent/field extraction (14,400 RPD free tier)
- `llm_model` = `llama-3.1-8b-instant` by default; switch to `llama-3.3-70b-versatile` in `.env` for better quality on paid tier
- `stt_model` = `whisper-large-v3`

**Session storage:** Redis with in-memory dict fallback. Sessions expire after 1 hour (`session_ttl_seconds`). Redis failure is non-fatal.

**The AI service queries PostgreSQL directly** (not via the Laravel API) for all reads. The Laravel backend's `/v1/internal/*` routes exist for appointment creation from a Laravel context, but the AI service uses `db_service.py` instead for lower latency.

## Laravel Backend architecture

**`backend/`** — Laravel 11, auth + admin CRUD + data seeding.

- `routes/api.php` — three route groups: public auth, internal (AI→backend via `X-Internal-Secret` header), authenticated admin
- `app/Http/Controllers/Api/V1/InternalController.php` — appointment booking endpoint called by AI service (currently not used in favour of direct DB access)
- `app/Models/` — `Doctor`, `Hospital`, `Department`, `DoctorSchedule`, `Appointment`, `Patient`, `CallLog`
- Role middleware: `super_admin` (full access), `hospital_admin` (own hospital only)
- Auth: JWT via `tymon/jwt-auth`

**Re-seed:**
```bash
cd backend && php artisan migrate:fresh --seed --force
```

## Frontend architecture

**`frontend/src/`** — Next.js 15 App Router, admin dashboard only (not patient-facing).

- `app/` — pages: dashboard, doctors, hospitals, appointments, call-logs, analytics, settings
- `components/layout/DashboardLayout.tsx` — sidebar + top nav wrapper
- `lib/api.ts` — all API calls (axios, JWT from cookie, auto-redirect on 401)
- Data fetching: TanStack Query v5
- UI: Tailwind CSS + Radix UI primitives + Recharts for analytics charts

**Frontend commands:**
```bash
cd frontend
npm run dev    # dev server at :3000
npm run build  # production build
npm run lint   # ESLint
```

## Database schema key points

- `doctors` belongs to one `hospital_id` (primary) but can also be linked to multiple hospitals via `doctor_hospitals` pivot
- `doctor_schedules`: `day_of_week` uses **Sunday=0 … Saturday=6** (matches Carbon/JS convention) — **not** Python's Monday=0
- `appointments.serial_number` is computed per doctor per date (MAX+1), not globally unique
- `patients` are upserted on `(hospital_id, phone)` unique constraint
- Redis port inside Docker network: `6379`. External (host): `6380`.
- PostgreSQL port inside Docker network: `5432`. External (host): `5433`.

## Day-of-week mapping (common source of bugs)

Python `date.weekday()` returns Mon=0, Sun=6.  
The DB `doctor_schedules.day_of_week` uses Sun=0, Sat=6.  
`db_service.get_slots()` converts: `db_day = (d.weekday() + 1) % 7`.
