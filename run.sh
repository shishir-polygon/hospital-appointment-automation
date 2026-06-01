#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  AI Doctor Booking Platform — Run Script
#  Usage: bash run.sh [--fresh]
#  --fresh : drop and re-seed the database
# ══════════════════════════════════════════════════════════════

set -e
FRESH=false
[[ "$1" == "--fresh" ]] && FRESH=true

# ── Colors ────────────────────────────────────────────────────
G="\033[32m"; Y="\033[33m"; B="\033[34m"; R="\033[31m"; C="\033[36m"; W="\033[0m"
ok()   { echo -e "${G}✓${W}  $1"; }
info() { echo -e "${B}→${W}  $1"; }
warn() { echo -e "${Y}⚠${W}  $1"; }
err()  { echo -e "${R}✗${W}  $1"; }

echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   AI Doctor Booking Platform                     ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""

# ── Check prerequisites ───────────────────────────────────────
command -v docker >/dev/null 2>&1 || { err "Docker not found. Install Docker first."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "Docker Compose v2 not found."; exit 1; }

# ── Check .env ────────────────────────────────────────────────
if [ ! -f .env ]; then
    warn ".env not found. Run setup.sh first."
    exit 1
fi

source .env

# ── Start containers ──────────────────────────────────────────
info "Starting all Docker containers..."
docker compose up -d --remove-orphans 2>/dev/null
ok "Containers started"

# ── Wait for PostgreSQL ───────────────────────────────────────
info "Waiting for PostgreSQL..."
for i in $(seq 1 30); do
    docker exec ai_doctor_postgres pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 2
done
ok "PostgreSQL ready"

# ── Wait for backend ──────────────────────────────────────────
info "Waiting for backend API..."
for i in $(seq 1 30); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health 2>/dev/null || echo "000")
    [ "$STATUS" != "000" ] && break
    sleep 2
done
ok "Backend ready"

# ── Run migrations ────────────────────────────────────────────
if [ "$FRESH" = true ]; then
    info "Dropping and re-seeding database (--fresh)..."
    docker exec ai_doctor_backend php artisan migrate:fresh --seed --force
    ok "Database re-seeded"
else
    info "Running pending migrations..."
    docker exec ai_doctor_backend php artisan migrate --force 2>/dev/null || true
    ok "Migrations done"
fi

# ── Container status ──────────────────────────────────────────
echo ""
echo -e "${C}── Container Status ────────────────────────────────${W}"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -v "^time" || \
docker compose ps

# ── Print URLs and credentials ────────────────────────────────
echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   Access URLs                                     ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""
echo -e "  ${G}Admin Panel (Frontend)${W}  →  http://localhost:3000"
echo -e "  ${G}Backend API${W}             →  http://localhost:8000/api/v1"
echo -e "  ${G}AI Voice Demo${W}           →  http://localhost:8001"
echo -e "  ${G}Nginx Proxy${W}             →  http://localhost:8080"
echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   Credentials                                     ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""
echo -e "  ${Y}Super Admin${W}"
echo -e "    Email    :  admin@hospital.com"
echo -e "    Password :  password"
echo ""
echo -e "  ${Y}Hospital Admin (Demo Hospital)${W}"
echo -e "    Email    :  hospitaladmin@demo.com"
echo -e "    Password :  password"
echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   Database                                        ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""
echo -e "  Host     :  localhost:5433"
echo -e "  Database :  ai_doctor"
echo -e "  User     :  postgres"
echo -e "  Password :  secret"
echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   AI Services                                     ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""
echo -e "  LLM      :  Groq llama-3.3-70b-versatile"
echo -e "  STT      :  Groq Whisper large-v3"
echo -e "  TTS      :  Google TTS (gTTS)"
echo -e "  Redis    :  localhost:6380  (password: secret)"
echo ""
echo -e "${C}══════════════════════════════════════════════════${W}"
echo -e "${C}   Useful Commands                                 ${W}"
echo -e "${C}══════════════════════════════════════════════════${W}"
echo ""
echo -e "  Stop all       :  docker compose stop"
echo -e "  Restart all    :  docker compose restart"
echo -e "  View logs      :  docker compose logs -f [service]"
echo -e "  Re-seed DB     :  bash run.sh --fresh"
echo -e "  Backend shell  :  docker exec -it ai_doctor_backend bash"
echo -e "  DB shell       :  docker exec -it ai_doctor_postgres psql -U postgres -d ai_doctor"
echo ""
