#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Doctor Booking Platform — Setup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Prerequisites ──────────────────────────────────────────────────────────────
command -v docker  >/dev/null 2>&1 || { echo "✗ Docker not found. Install Docker first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "✗ Docker Compose v2 not found."; exit 1; }
echo "✓ Prerequisites OK"

# ── Root .env ──────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
    echo ""
    echo "⚠  No .env file found. Creating one now..."
    cat > .env << 'ENVEOF'
# Application
APP_NAME="AI Doctor Booking"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database (Docker service name — do NOT use 127.0.0.1 here)
DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=ai_doctor
DB_USERNAME=postgres
DB_PASSWORD=secret

# Redis (Docker service name)
REDIS_HOST=redis
REDIS_PASSWORD=secret
REDIS_PORT=6379

# JWT
JWT_SECRET=
JWT_ALGO=HS256

# Internal API Secret (Backend <-> AI Service)
BACKEND_API_SECRET=change_this_secret_key_32chars_xx

# Groq API (free) — https://console.groq.com
GROQ_API_KEY=gsk_your_groq_api_key_here

# Twilio (free trial) — https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Email (log driver = save to storage/logs, no SMTP needed for dev)
MAIL_MAILER=log
MAIL_FROM_ADDRESS=noreply@aidoctorbooking.com
MAIL_FROM_NAME="AI Doctor Booking"

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_APP_NAME="AI Doctor Booking"
ENVEOF
    echo "✓ .env created"
    echo ""
    echo "   Edit .env and set GROQ_API_KEY before continuing."
    echo "   Twilio fields are optional (needed only for phone calls)."
    read -p "   Press Enter to continue..."
fi

# ── Generate APP_KEY and JWT_SECRET if missing ────────────────────────────────
echo ""
echo "→ Generating secrets..."

if ! grep -q "APP_KEY=base64:" .env 2>/dev/null; then
    APP_KEY="base64:$(openssl rand -base64 32)"
    sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" .env
    echo "✓ APP_KEY generated"
fi

if grep -q "^JWT_SECRET=$" .env 2>/dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
    echo "✓ JWT_SECRET generated"
fi

source .env

# ── backend/.env (Docker-internal hostnames) ───────────────────────────────────
echo ""
echo "→ Configuring backend/.env..."

cp .env backend/.env

# Ensure backend .env uses Docker-internal service names (not localhost)
sed -i "s|^DB_HOST=.*|DB_HOST=postgres|"     backend/.env
sed -i "s|^DB_PORT=.*|DB_PORT=5432|"         backend/.env
sed -i "s|^REDIS_HOST=.*|REDIS_HOST=redis|"  backend/.env
sed -i "s|^REDIS_PASSWORD=null|REDIS_PASSWORD=secret|" backend/.env

echo "✓ backend/.env configured (DB_HOST=postgres, REDIS_HOST=redis)"

# ── ai-service/.env ────────────────────────────────────────────────────────────
echo ""
echo "→ Configuring ai-service/.env..."

if [ ! -f ai-service/.env ]; then
    cat > ai-service/.env << EOF
GROQ_API_KEY=${GROQ_API_KEY}
TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
BACKEND_API_URL=http://backend:8000/api/v1
BACKEND_API_SECRET=${BACKEND_API_SECRET:-change_this_secret_key_32chars_xx}
REDIS_URL=redis://:${REDIS_PASSWORD:-secret}@redis:6379/0
LLM_MODEL=llama-3.3-70b-versatile
STT_MODEL=whisper-large-v3
EOF
    echo "✓ ai-service/.env created"
else
    echo "✓ ai-service/.env already exists (skipped)"
fi

# ── Required frontend files ────────────────────────────────────────────────────
echo ""
echo "→ Checking required frontend files..."

# postcss.config.js — REQUIRED for Tailwind CSS to work
if [ ! -f frontend/postcss.config.js ]; then
    cat > frontend/postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
    echo "✓ frontend/postcss.config.js created (required for Tailwind)"
else
    echo "✓ frontend/postcss.config.js exists"
fi

# tsconfig.json — REQUIRED for @/ path aliases
if [ ! -f frontend/tsconfig.json ]; then
    cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF
    echo "✓ frontend/tsconfig.json created (required for @/ imports)"
else
    echo "✓ frontend/tsconfig.json exists"
fi

# public/ directory — REQUIRED for Docker standalone build
mkdir -p frontend/public
touch frontend/public/.gitkeep
echo "✓ frontend/public/ directory exists"

# ── Nginx config ───────────────────────────────────────────────────────────────
echo ""
echo "→ Creating nginx config..."
mkdir -p nginx
cat > nginx/nginx.conf << 'NGINX'
events { worker_connections 1024; }

http {
    upstream backend    { server backend:8000; }
    upstream frontend   { server frontend:3000; }
    upstream ai_service { server ai-service:8001; }

    server {
        listen 80;
        client_max_body_size 50M;

        location /api/  { proxy_pass http://backend/api/;  proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
        location /ai/   { proxy_pass http://ai_service/;   proxy_set_header Host $host; }
        location /      { proxy_pass http://frontend/;     proxy_set_header Host $host; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
    }
}
NGINX
echo "✓ nginx/nginx.conf created"

# ── Build and start Docker containers ─────────────────────────────────────────
echo ""
echo "→ Building and starting Docker containers..."
docker compose up -d --build
echo "✓ All containers started"

# ── Wait for PostgreSQL to be ready ───────────────────────────────────────────
echo ""
echo "→ Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
    if docker exec ai_doctor_postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✓ PostgreSQL ready"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 2
done

# ── Run migrations and seed ───────────────────────────────────────────────────
echo ""
echo "→ Running database migrations and seeding..."
docker exec ai_doctor_backend php artisan migrate:fresh --seed --force
echo "✓ Database migrated and seeded"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Access:"
echo "    Admin Panel  → http://localhost:3000"
echo "    Backend API  → http://localhost:8000/api/v1"
echo "    AI Service   → http://localhost:8001"
echo "    Nginx Proxy  → http://localhost:8080"
echo ""
echo "  Default logins:"
echo "    Super Admin    → admin@hospital.com / password"
echo "    Hospital Admin → hospitaladmin@demo.com / password"
echo ""
echo "  Restart all services:"
echo "    docker compose restart"
echo ""
echo "  View logs:"
echo "    docker compose logs -f backend"
echo "    docker compose logs -f ai-service"
echo ""
echo "  Twilio webhook (set in Twilio console after ngrok/deploy):"
echo "    Voice: http://YOUR_PUBLIC_IP:8001/twilio/incoming"
echo ""
